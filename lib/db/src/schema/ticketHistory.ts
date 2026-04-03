import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { positionTicketsTable } from "./positionTickets";

export const ticketHistoryTable = pgTable("ticket_history", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").references(() => positionTicketsTable.id, { onDelete: "cascade" }).notNull(),
  userId: integer("user_id").notNull(),
  authorName: text("author_name").notNull(),
  field: text("field").notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  changedAt: timestamp("changed_at").notNull().defaultNow(),
});

export type TicketHistory = typeof ticketHistoryTable.$inferSelect;
