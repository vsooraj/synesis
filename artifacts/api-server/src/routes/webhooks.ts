import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import crypto from "crypto";
import { db, webhookConfigsTable, webhookDeliveriesTable, WEBHOOK_EVENTS } from "@workspace/db";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { emitWebhookEvent } from "../lib/webhookDelivery.js";

const router: IRouter = Router();

router.get("/enterprise/webhooks/config", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const [config] = await db.select({
      id: webhookConfigsTable.id,
      url: webhookConfigsTable.url,
      enabledEvents: webhookConfigsTable.enabledEvents,
      enabled: webhookConfigsTable.enabled,
      description: webhookConfigsTable.description,
      updatedAt: webhookConfigsTable.updatedAt,
    }).from(webhookConfigsTable).where(eq(webhookConfigsTable.tenantId, req.user!.tenantId));
    res.json(config ?? null);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Server error" });
  }
});

router.put("/enterprise/webhooks/config", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const { url, enabledEvents, enabled, description } = req.body as {
      url: string;
      enabledEvents?: string[];
      enabled?: boolean;
      description?: string;
    };

    if (!url || typeof url !== "string") {
      res.status(400).json({ error: "url is required" });
      return;
    }

    try { new URL(url); } catch {
      res.status(400).json({ error: "url must be a valid URL" });
      return;
    }

    const existing = await db.select({ id: webhookConfigsTable.id, secret: webhookConfigsTable.secret })
      .from(webhookConfigsTable).where(eq(webhookConfigsTable.tenantId, req.user!.tenantId));

    const secret = existing[0]?.secret ?? crypto.randomBytes(32).toString("hex");
    const eventsJson = JSON.stringify(enabledEvents ?? []);

    let result;
    if (existing[0]) {
      [result] = await db.update(webhookConfigsTable).set({
        url,
        enabledEvents: eventsJson,
        enabled: enabled ?? true,
        description: description ?? null,
        updatedAt: new Date(),
      }).where(eq(webhookConfigsTable.tenantId, req.user!.tenantId)).returning();
    } else {
      [result] = await db.insert(webhookConfigsTable).values({
        tenantId: req.user!.tenantId,
        url,
        secret,
        enabledEvents: eventsJson,
        enabled: enabled ?? true,
        description: description ?? null,
      }).returning();
    }

    const { secret: _s, ...safe } = result;
    res.json(safe);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Server error" });
  }
});

router.delete("/enterprise/webhooks/config", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    await db.delete(webhookConfigsTable).where(eq(webhookConfigsTable.tenantId, req.user!.tenantId));
    res.sendStatus(204);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Server error" });
  }
});

router.get("/enterprise/webhooks/deliveries", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit ?? "50")), 200);
    const deliveries = await db.select().from(webhookDeliveriesTable)
      .where(eq(webhookDeliveriesTable.tenantId, req.user!.tenantId))
      .orderBy(desc(webhookDeliveriesTable.createdAt))
      .limit(limit);
    res.json(deliveries);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Server error" });
  }
});

router.post("/enterprise/webhooks/test/:event", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const event = req.params.event;
    if (!WEBHOOK_EVENTS.includes(event as typeof WEBHOOK_EVENTS[number])) {
      res.status(400).json({ error: `Unknown event. Valid events: ${WEBHOOK_EVENTS.join(", ")}` });
      return;
    }

    const [config] = await db.select({ id: webhookConfigsTable.id })
      .from(webhookConfigsTable).where(eq(webhookConfigsTable.tenantId, req.user!.tenantId));
    if (!config) {
      res.status(404).json({ error: "No webhook configured. Set up a webhook URL first." });
      return;
    }

    const testData: Record<string, unknown> = {
      "candidate.uploaded":     { resumeProfileId: 0, candidateName: "Test Candidate", fileName: "resume.pdf", chunksIndexed: 5 },
      "shortlist.pending_approval": { shortlistId: 0, jobTitle: "Senior Engineer", totalShortlisted: 3 },
      "shortlist.approved":     { shortlistId: 0, jobTitle: "Senior Engineer", totalShortlisted: 3, approvedBy: "HR Admin", note: "Looks great" },
      "shortlist.rejected":     { shortlistId: 0, jobTitle: "Senior Engineer", rejectedBy: "HR Admin", note: "Need more senior profiles" },
      "bulk_job.completed":     { bulkJobId: 0, jobTitle: "Senior Engineer", totalCandidates: 5, averageScore: 72 },
      "position.opened":        { positionId: 0, title: "Senior Engineer", priority: "High" },
      "position.closed":        { positionId: 0, title: "Senior Engineer", reason: "Filled" },
    }[event] ?? { test: true };

    await emitWebhookEvent(req.user!.tenantId, event, { ...testData, _test: true });
    res.json({ queued: true, event, message: "Test event queued for delivery" });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Server error" });
  }
});

router.get("/enterprise/webhooks/events", requireAuth, (_req, res) => {
  res.json({ events: WEBHOOK_EVENTS });
});

router.get("/enterprise/webhooks/template/:file", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const { file } = req.params;
  if (!/^[\w-]+\.json$/.test(file)) { res.status(400).json({ error: "Invalid file" }); return; }
  try {
    const { readFile } = await import("fs/promises");
    const { join, dirname } = await import("path");
    const { fileURLToPath } = await import("url");
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const templatePath = join(__dirname, "../../../../../docs/n8n", file);
    const content = await readFile(templatePath, "utf-8");
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="${file}"`);
    res.send(content);
  } catch {
    res.status(404).json({ error: "Template not found" });
  }
});

export default router;
