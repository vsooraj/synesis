import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db, webhookConfigsTable, webhookDeliveriesTable } from "@workspace/db";
import type { WebhookEvent } from "@workspace/db";

const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [0, 30_000, 300_000];

export interface WebhookPayload {
  event: WebhookEvent | string;
  tenantId: number;
  timestamp: string;
  data: Record<string, unknown>;
}

function sign(secret: string, body: string): string {
  return "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");
}

async function attempt(deliveryId: number, url: string, secret: string, body: string, attemptNum: number): Promise<void> {
  const signature = sign(secret, body);
  let responseStatus: number | null = null;
  let error: string | null = null;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-MatchPoint-Signature": signature,
        "X-MatchPoint-Delivery": String(deliveryId),
        "User-Agent": "MatchPoint-Webhooks/1.0",
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    responseStatus = response.status;

    if (response.ok) {
      await db.update(webhookDeliveriesTable).set({
        status: "delivered",
        attempts: attemptNum,
        lastAttemptAt: new Date(),
        deliveredAt: new Date(),
        responseStatus,
        lastError: null,
      }).where(eq(webhookDeliveriesTable.id, deliveryId));
      return;
    }
    error = `HTTP ${response.status}: ${(await response.text()).slice(0, 200)}`;
  } catch (e) {
    error = e instanceof Error ? e.message : "Network error";
  }

  const isFinal = attemptNum >= MAX_ATTEMPTS;
  await db.update(webhookDeliveriesTable).set({
    status: isFinal ? "failed" : "retrying",
    attempts: attemptNum,
    lastAttemptAt: new Date(),
    responseStatus,
    lastError: error,
  }).where(eq(webhookDeliveriesTable.id, deliveryId));

  if (!isFinal) {
    const delay = RETRY_DELAYS_MS[attemptNum] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
    setTimeout(() => attempt(deliveryId, url, secret, body, attemptNum + 1), delay);
  }
}

export async function emitWebhookEvent(tenantId: number, event: string, data: Record<string, unknown>): Promise<void> {
  try {
    const [config] = await db.select()
      .from(webhookConfigsTable)
      .where(eq(webhookConfigsTable.tenantId, tenantId));

    if (!config || !config.enabled) return;

    const enabledEvents: string[] = JSON.parse(config.enabledEvents);
    if (enabledEvents.length > 0 && !enabledEvents.includes(event)) return;

    const payload: WebhookPayload = {
      event,
      tenantId,
      timestamp: new Date().toISOString(),
      data,
    };
    const body = JSON.stringify(payload);

    const [delivery] = await db.insert(webhookDeliveriesTable).values({
      tenantId,
      event,
      payload,
      status: "pending",
      attempts: 0,
    }).returning();

    setTimeout(() => attempt(delivery.id, config.url, config.secret, body, 1), 0);
  } catch (err) {
    console.error("[webhook] emit error:", err);
  }
}
