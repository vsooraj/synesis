import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";
import { resumeProfilesTable } from "./resumeProfiles";

export const resumeChunksTable = pgTable("resume_chunks", {
  id: serial("id").primaryKey(),
  resumeProfileId: integer("resume_profile_id").references(() => resumeProfilesTable.id, { onDelete: "cascade" }).notNull(),
  tenantId: integer("tenant_id").references(() => tenantsTable.id).notNull(),
  section: text("section").notNull().default("General"),
  chunkText: text("chunk_text").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ResumeChunk = typeof resumeChunksTable.$inferSelect;
