import { pgTable, serial, timestamp, integer, text } from "drizzle-orm/pg-core";
import { positionTicketsTable } from "./positionTickets";
import { resumeProfilesTable } from "./resumeProfiles";

export const CANDIDATE_STAGES = ["Applied", "Screening", "Interview", "Final", "Offered", "Hired", "Rejected"] as const;

export const ticketCandidatesTable = pgTable("ticket_candidates", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").references(() => positionTicketsTable.id, { onDelete: "cascade" }).notNull(),
  resumeProfileId: integer("resume_profile_id").references(() => resumeProfilesTable.id, { onDelete: "cascade" }).notNull(),
  stage: text("stage").notNull().default("Applied"),
  note: text("note"),
  addedBy: integer("added_by"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type TicketCandidate = typeof ticketCandidatesTable.$inferSelect;
