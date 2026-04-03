import { pgTable, text, serial, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { usersTable } from "./users";
import { jobDescriptionsTable } from "./jobDescriptions";

export type BulkJobStatus = "Pending" | "Running" | "Complete" | "Failed";

export const bulkJobsTable = pgTable("bulk_jobs", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenantsTable.id).notNull(),
  createdBy: integer("created_by").references(() => usersTable.id),
  jobDescriptionId: integer("job_description_id").references(() => jobDescriptionsTable.id).notNull(),
  status: text("status").notNull().default("Pending").$type<BulkJobStatus>(),
  total: integer("total").notNull().default(0),
  processed: integer("processed").notNull().default(0),
  failed: integer("failed").notNull().default(0),
  resumeProfileIds: jsonb("resume_profile_ids").notNull().$type<number[]>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const bulkJobResultsTable = pgTable("bulk_job_results", {
  id: serial("id").primaryKey(),
  bulkJobId: integer("bulk_job_id").references(() => bulkJobsTable.id).notNull(),
  resumeProfileId: integer("resume_profile_id").notNull(),
  analysisId: integer("analysis_id"),
  status: text("status").notNull().default("Pending"),
  error: text("error"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertBulkJobSchema = createInsertSchema(bulkJobsTable).omit({ id: true, createdAt: true, completedAt: true });
export type InsertBulkJob = z.infer<typeof insertBulkJobSchema>;
export type BulkJob = typeof bulkJobsTable.$inferSelect;
export type BulkJobResult = typeof bulkJobResultsTable.$inferSelect;
