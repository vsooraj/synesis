import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";

export const WEBHOOK_EVENTS = [
  "candidate.uploaded",
  "shortlist.pending_approval",
  "shortlist.approved",
  "shortlist.rejected",
  "bulk_job.completed",
  "position.opened",
  "position.closed",
  "interview.scheduled",
  "interview.feedback_requested",
] as const;

export type WebhookEvent = typeof WEBHOOK_EVENTS[number];

export const webhookConfigsTable = pgTable("webhook_configs", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenantsTable.id, { onDelete: "cascade" }).notNull().unique(),
  url: text("url").notNull(),
  secret: text("secret").notNull(),
  enabledEvents: text("enabled_events").notNull().default(JSON.stringify([])),
  enabled: boolean("enabled").notNull().default(true),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type WebhookConfig = typeof webhookConfigsTable.$inferSelect;
