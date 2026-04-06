import { pgTable, text, serial, timestamp, integer, jsonb, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { usersTable } from "./users";
import { jobDescriptionsTable } from "./jobDescriptions";

export type ShortlistStatus = "Pending" | "Running" | "Pending Approval" | "Approved" | "Rejected" | "Failed";

export const shortlistJobsTable = pgTable("shortlist_jobs", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenantsTable.id).notNull(),
  createdBy: integer("created_by").references(() => usersTable.id),
  jobDescriptionId: integer("job_description_id").references(() => jobDescriptionsTable.id).notNull(),
  status: text("status").notNull().default("Pending").$type<ShortlistStatus>(),
  scoreThreshold: integer("score_threshold").notNull().default(70),
  maxCandidates: integer("max_candidates").notNull().default(50),
  totalSearched: integer("total_searched").notNull().default(0),
  totalShortlisted: integer("total_shortlisted").notNull().default(0),
  reportMarkdown: text("report_markdown"),
  agentLog: jsonb("agent_log").$type<string[]>().default([]),
  approvedBy: integer("approved_by").references(() => usersTable.id),
  approvalNote: text("approval_note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
  approvedAt: timestamp("approved_at"),
});

export const shortlistResultsTable = pgTable("shortlist_results", {
  id: serial("id").primaryKey(),
  shortlistJobId: integer("shortlist_job_id").references(() => shortlistJobsTable.id).notNull(),
  resumeProfileId: integer("resume_profile_id").notNull(),
  similarityScore: real("similarity_score"),
  overallScore: real("overall_score"),
  summary: text("summary"),
  strengths: jsonb("strengths").$type<string[]>(),
  gaps: jsonb("gaps").$type<string[]>(),
  included: text("included").notNull().default("yes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertShortlistJobSchema = createInsertSchema(shortlistJobsTable).omit({ id: true, createdAt: true, completedAt: true, approvedAt: true });
export type InsertShortlistJob = z.infer<typeof insertShortlistJobSchema>;
export type ShortlistJob = typeof shortlistJobsTable.$inferSelect;
export type ShortlistResult = typeof shortlistResultsTable.$inferSelect;
