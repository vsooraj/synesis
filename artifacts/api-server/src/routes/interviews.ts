import { Router, type IRouter } from "express";
import { eq, and, gte, lte, desc, asc } from "drizzle-orm";
import {
  db, interviewSlotsTable, positionTicketsTable, ticketCandidatesTable,
  resumeProfilesTable, INTERVIEW_TYPES, INTERVIEW_STATUSES,
} from "@workspace/db";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { emitWebhookEvent } from "../lib/webhookDelivery.js";
import { logAction } from "../lib/audit.js";

const router: IRouter = Router();

async function enrichSlot(slot: typeof interviewSlotsTable.$inferSelect) {
  let candidate = null;
  if (slot.resumeProfileId) {
    const [rp] = await db.select({
      id: resumeProfilesTable.id,
      candidateName: resumeProfilesTable.candidateName,
      candidateEmail: resumeProfilesTable.candidateEmail,
      fileName: resumeProfilesTable.fileName,
    }).from(resumeProfilesTable).where(eq(resumeProfilesTable.id, slot.resumeProfileId));
    candidate = rp ?? null;
  }
  let ticket = null;
  const [t] = await db.select({ id: positionTicketsTable.id, title: positionTicketsTable.title, status: positionTicketsTable.status })
    .from(positionTicketsTable).where(eq(positionTicketsTable.id, slot.ticketId));
  ticket = t ?? null;
  return { ...slot, candidate, ticket, interviewers: JSON.parse(slot.interviewers ?? "[]") };
}

router.get("/enterprise/interviews", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const { ticketId, status, from, to } = req.query as { ticketId?: string; status?: string; from?: string; to?: string };
    let query = db.select().from(interviewSlotsTable)
      .where(eq(interviewSlotsTable.tenantId, req.user!.tenantId))
      .$dynamic();

    if (ticketId) query = query.where(eq(interviewSlotsTable.ticketId, parseInt(ticketId)));
    if (status) query = query.where(eq(interviewSlotsTable.status, status));
    if (from) query = query.where(gte(interviewSlotsTable.scheduledAt, new Date(from)));
    if (to) query = query.where(lte(interviewSlotsTable.scheduledAt, new Date(to)));

    const slots = await query.orderBy(asc(interviewSlotsTable.scheduledAt));
    const enriched = await Promise.all(slots.map(enrichSlot));
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Server error" });
  }
});

router.get("/enterprise/interviews/upcoming", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const days = parseInt((req.query.days as string) ?? "14");
    const now = new Date();
    const until = new Date(now.getTime() + days * 86400_000);
    const slots = await db.select().from(interviewSlotsTable)
      .where(and(
        eq(interviewSlotsTable.tenantId, req.user!.tenantId),
        eq(interviewSlotsTable.status, "Scheduled"),
        gte(interviewSlotsTable.scheduledAt, now),
        lte(interviewSlotsTable.scheduledAt, until),
      ))
      .orderBy(asc(interviewSlotsTable.scheduledAt));
    const enriched = await Promise.all(slots.map(enrichSlot));
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Server error" });
  }
});

router.post("/enterprise/interviews", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const { ticketId, ticketCandidateId, resumeProfileId, scheduledAt, durationMinutes, type, interviewers, meetingLink, location, notes } = req.body as {
      ticketId: number; ticketCandidateId?: number; resumeProfileId?: number; scheduledAt: string;
      durationMinutes?: number; type?: string; interviewers?: string[]; meetingLink?: string; location?: string; notes?: string;
    };

    if (!ticketId || !scheduledAt) { res.status(400).json({ error: "ticketId and scheduledAt are required" }); return; }
    if (type && !INTERVIEW_TYPES.includes(type as typeof INTERVIEW_TYPES[number])) {
      res.status(400).json({ error: `type must be one of: ${INTERVIEW_TYPES.join(", ")}` }); return;
    }

    const [ticket] = await db.select({ id: positionTicketsTable.id, title: positionTicketsTable.title })
      .from(positionTicketsTable)
      .where(and(eq(positionTicketsTable.id, ticketId), eq(positionTicketsTable.tenantId, req.user!.tenantId)));
    if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }

    const [slot] = await db.insert(interviewSlotsTable).values({
      tenantId: req.user!.tenantId,
      ticketId,
      ticketCandidateId: ticketCandidateId ?? null,
      resumeProfileId: resumeProfileId ?? null,
      scheduledAt: new Date(scheduledAt),
      durationMinutes: durationMinutes ?? 60,
      type: type ?? "Video",
      status: "Scheduled",
      interviewers: JSON.stringify(interviewers ?? []),
      meetingLink: meetingLink ?? null,
      location: location ?? null,
      notes: notes ?? null,
      createdBy: req.user!.userId,
    }).returning();

    await logAction(req.user!.tenantId, req.user!.userId, "CREATE_INTERVIEW", "interview_slot", slot.id, { ticketId, scheduledAt, type });
    emitWebhookEvent(req.user!.tenantId, "interview.scheduled", {
      interviewId: slot.id, ticketId, positionTitle: ticket.title,
      scheduledAt, type: slot.type, durationMinutes: slot.durationMinutes,
    });

    const enriched = await enrichSlot(slot);
    res.status(201).json(enriched);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Server error" });
  }
});

router.get("/enterprise/interviews/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const [slot] = await db.select().from(interviewSlotsTable)
      .where(and(eq(interviewSlotsTable.id, id), eq(interviewSlotsTable.tenantId, req.user!.tenantId)));
    if (!slot) { res.status(404).json({ error: "Interview not found" }); return; }
    res.json(await enrichSlot(slot));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Server error" });
  }
});

router.patch("/enterprise/interviews/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const [existing] = await db.select().from(interviewSlotsTable)
      .where(and(eq(interviewSlotsTable.id, id), eq(interviewSlotsTable.tenantId, req.user!.tenantId)));
    if (!existing) { res.status(404).json({ error: "Interview not found" }); return; }

    const allowed = ["scheduledAt", "durationMinutes", "type", "meetingLink", "location", "notes", "feedback", "rating"] as const;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    for (const field of allowed) {
      if (req.body[field] !== undefined) {
        const val = req.body[field];
        updates[field] = (val === "" || val === null) ? null : field === "scheduledAt" ? new Date(val as string) : val;
      }
    }
    if (req.body.interviewers !== undefined) {
      updates.interviewers = JSON.stringify(Array.isArray(req.body.interviewers) ? req.body.interviewers : []);
    }

    const [updated] = await db.update(interviewSlotsTable).set(updates).where(eq(interviewSlotsTable.id, id)).returning();
    res.json(await enrichSlot(updated));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Server error" });
  }
});

router.post("/enterprise/interviews/:id/complete", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const { feedback, rating } = req.body as { feedback?: string; rating?: number };
    const [updated] = await db.update(interviewSlotsTable)
      .set({ status: "Completed", feedback: feedback ?? null, rating: rating ?? null, updatedAt: new Date() })
      .where(and(eq(interviewSlotsTable.id, id), eq(interviewSlotsTable.tenantId, req.user!.tenantId))).returning();
    if (!updated) { res.status(404).json({ error: "Interview not found" }); return; }
    await logAction(req.user!.tenantId, req.user!.userId, "COMPLETE_INTERVIEW", "interview_slot", id, { rating });
    res.json(await enrichSlot(updated));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Server error" });
  }
});

router.post("/enterprise/interviews/:id/cancel", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const { reason } = req.body as { reason?: string };
    const [updated] = await db.update(interviewSlotsTable)
      .set({ status: "Cancelled", notes: reason ? `Cancelled: ${reason}` : null, updatedAt: new Date() })
      .where(and(eq(interviewSlotsTable.id, id), eq(interviewSlotsTable.tenantId, req.user!.tenantId))).returning();
    if (!updated) { res.status(404).json({ error: "Interview not found" }); return; }
    res.json(await enrichSlot(updated));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Server error" });
  }
});

router.post("/enterprise/interviews/:id/noshow", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const [updated] = await db.update(interviewSlotsTable)
      .set({ status: "No-show", updatedAt: new Date() })
      .where(and(eq(interviewSlotsTable.id, id), eq(interviewSlotsTable.tenantId, req.user!.tenantId))).returning();
    if (!updated) { res.status(404).json({ error: "Interview not found" }); return; }
    res.json(await enrichSlot(updated));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Server error" });
  }
});

router.delete("/enterprise/interviews/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const [deleted] = await db.delete(interviewSlotsTable)
      .where(and(eq(interviewSlotsTable.id, id), eq(interviewSlotsTable.tenantId, req.user!.tenantId))).returning();
    if (!deleted) { res.status(404).json({ error: "Interview not found" }); return; }
    await logAction(req.user!.tenantId, req.user!.userId, "DELETE_INTERVIEW", "interview_slot", id);
    res.sendStatus(204);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Server error" });
  }
});

export default router;
