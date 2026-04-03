import { pgTable, text, serial, timestamp, integer, date } from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";
import { jobDescriptionsTable } from "./jobDescriptions";

export const TICKET_STATUSES = ["Draft", "Open", "Sourcing", "Screening", "Interviewing", "Offer", "Closed"] as const;
export const TICKET_PRIORITIES = ["Critical", "High", "Medium", "Low"] as const;
export const CLOSE_REASONS = ["Filled", "Cancelled", "On Hold"] as const;

export type TicketStatus = typeof TICKET_STATUSES[number];
export type TicketPriority = typeof TICKET_PRIORITIES[number];

export const positionTicketsTable = pgTable("position_tickets", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").references(() => tenantsTable.id, { onDelete: "cascade" }).notNull(),
  title: text("title").notNull(),
  jobDescriptionId: integer("job_description_id").references(() => jobDescriptionsTable.id, { onDelete: "set null" }),
  status: text("status").notNull().default("Draft"),
  priority: text("priority").notNull().default("Medium"),
  assignedTo: text("assigned_to").notNull().default("[]"),
  hiringManagerId: integer("hiring_manager_id"),
  department: text("department"),
  location: text("location"),
  salaryRange: text("salary_range"),
  openings: integer("openings").notNull().default(1),
  filled: integer("filled").notNull().default(0),
  targetStartDate: date("target_start_date"),
  closeReason: text("close_reason"),
  tags: text("tags").notNull().default("[]"),
  description: text("description"),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type PositionTicket = typeof positionTicketsTable.$inferSelect;
