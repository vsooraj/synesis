import { pgTable, text, serial, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";

export const webhookDeliveriesTable = pgTable("webhook_deliveries", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenantsTable.id, { onDelete: "cascade" }).notNull(),
  event: text("event").notNull(),
  payload: jsonb("payload").notNull(),
  status: text("status").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  lastAttemptAt: timestamp("last_attempt_at"),
  deliveredAt: timestamp("delivered_at"),
  lastError: text("last_error"),
  responseStatus: integer("response_status"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type WebhookDelivery = typeof webhookDeliveriesTable.$inferSelect;
