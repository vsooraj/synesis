import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";
import { positionTicketsTable } from "./positionTickets";
import { ticketCandidatesTable } from "./ticketCandidates";
import { resumeProfilesTable } from "./resumeProfiles";

export const INTERVIEW_TYPES = ["Phone", "Video", "Technical", "Onsite", "Panel"] as const;
export const INTERVIEW_STATUSES = ["Scheduled", "Completed", "Cancelled", "No-show"] as const;

export type InterviewType = typeof INTERVIEW_TYPES[number];
export type InterviewStatus = typeof INTERVIEW_STATUSES[number];

export const interviewSlotsTable = pgTable("interview_slots", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenantsTable.id, { onDelete: "cascade" }).notNull(),
  ticketId: integer("ticket_id").references(() => positionTicketsTable.id, { onDelete: "cascade" }).notNull(),
  ticketCandidateId: integer("ticket_candidate_id").references(() => ticketCandidatesTable.id, { onDelete: "set null" }),
  resumeProfileId: integer("resume_profile_id").references(() => resumeProfilesTable.id, { onDelete: "set null" }),
  interviewers: text("interviewers").notNull().default("[]"),
  scheduledAt: timestamp("scheduled_at").notNull(),
  durationMinutes: integer("duration_minutes").notNull().default(60),
  type: text("type").notNull().default("Video"),
  status: text("status").notNull().default("Scheduled"),
  meetingLink: text("meeting_link"),
  location: text("location"),
  notes: text("notes"),
  feedback: text("feedback"),
  feedbackData: text("feedback_data"),
  rating: integer("rating"),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type InterviewSlot = typeof interviewSlotsTable.$inferSelect;
