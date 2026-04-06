import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { positionTicketsTable } from "./positionTickets";

export const ticketCommentsTable = pgTable("ticket_comments", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").references(() => positionTicketsTable.id, { onDelete: "cascade" }).notNull(),
  userId: integer("user_id").notNull(),
  authorName: text("author_name").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type TicketComment = typeof ticketCommentsTable.$inferSelect;
