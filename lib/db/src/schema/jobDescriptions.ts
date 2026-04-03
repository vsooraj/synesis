import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { usersTable } from "./users";

export type JDStatus = "Draft" | "Active" | "Closed";

export const jobDescriptionsTable = pgTable("job_descriptions", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenantsTable.id).notNull(),
  createdBy: integer("created_by").references(() => usersTable.id),
  title: text("title").notNull(),
  company: text("company"),
  descriptionText: text("description_text").notNull(),
  status: text("status").notNull().default("Draft").$type<JDStatus>(),
  embedding: text("embedding"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertJobDescriptionSchema = createInsertSchema(jobDescriptionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertJobDescription = z.infer<typeof insertJobDescriptionSchema>;
export type JobDescription = typeof jobDescriptionsTable.$inferSelect;
