import { pgTable, text, serial, real, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const analysesTable = pgTable("analyses", {
  id: serial("id").primaryKey(),
  jobTitle: text("job_title"),
  companyName: text("company_name"),
  resumeText: text("resume_text").notNull(),
  jobDescription: text("job_description").notNull(),
  overallScore: real("overall_score").notNull(),
  summary: text("summary").notNull(),
  strengths: jsonb("strengths").notNull().$type<string[]>(),
  gaps: jsonb("gaps").notNull().$type<string[]>(),
  matchedKeywords: jsonb("matched_keywords").notNull().$type<Array<{ keyword: string; found: boolean; importance: "high" | "medium" | "low" }>>(),
  missingKeywords: jsonb("missing_keywords").notNull().$type<string[]>(),
  suggestions: jsonb("suggestions").notNull().$type<string[]>(),
  sectionScores: jsonb("section_scores").notNull().$type<{ skills: number; experience: number; education: number; keywords: number }>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAnalysisSchema = createInsertSchema(analysesTable).omit({ id: true, createdAt: true });
export type InsertAnalysis = z.infer<typeof insertAnalysisSchema>;
export type Analysis = typeof analysesTable.$inferSelect;
