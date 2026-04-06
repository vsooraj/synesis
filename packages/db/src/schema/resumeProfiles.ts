import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { usersTable } from "./users";

export type CandidateType = "Internal" | "External" | "Contractor";

export const resumeProfilesTable = pgTable("resume_profiles", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenantsTable.id).notNull(),
  userId: integer("user_id").references(() => usersTable.id),
  candidateType: text("candidate_type").notNull().default("External").$type<CandidateType>(),
  fileName: text("file_name"),
  candidateName: text("candidate_name"),
  candidateEmail: text("candidate_email"),
  extractedText: text("extracted_text").notNull(),
  embedding: text("embedding"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertResumeProfileSchema = createInsertSchema(resumeProfilesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertResumeProfile = z.infer<typeof insertResumeProfileSchema>;
export type ResumeProfile = typeof resumeProfilesTable.$inferSelect;
