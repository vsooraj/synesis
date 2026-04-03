import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import {
  db, positionTicketsTable, ticketCommentsTable, ticketCandidatesTable,
  ticketHistoryTable, jobDescriptionsTable, resumeProfilesTable,
  TICKET_STATUSES, TICKET_PRIORITIES,
} from "@workspace/db";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { emitWebhookEvent } from "../lib/webhookDelivery.js";
import { logAction } from "../lib/audit.js";

const router: IRouter = Router();

const SLA_DAYS: Record<string, number> = { Critical: 14, High: 21, Medium: 45, Low: 90 };

function calcSla(ticket: { priority: string; targetStartDate: string | null; createdAt: Date }) {
  const slaDays = SLA_DAYS[ticket.priority] ?? 45;
  const deadline = ticket.targetStartDate
    ? new Date(ticket.targetStartDate)
    : new Date(ticket.createdAt.getTime() + slaDays * 86400_000);
  const daysRemaining = Math.round((deadline.getTime() - Date.now()) / 86400_000);
  const pct = Math.max(0, Math.min(100, ((slaDays - daysRemaining) / slaDays) * 100));
  const slaBreach = daysRemaining < 0;
  const slaStatus = slaBreach ? "breached" : daysRemaining <= 7 ? "critical" : daysRemaining <= 14 ? "warning" : "ok";
  return { daysRemaining, slaBreach, slaStatus, deadline: deadline.toISOString().slice(0, 10), pct: Math.round(pct) };
}

async function recordHistory(ticketId: number, userId: number, authorName: string, field: string, oldValue: string | null, newValue: string | null) {
  await db.insert(ticketHistoryTable).values({ ticketId, userId, authorName, field, oldValue, newValue });
}

router.get("/enterprise/tickets", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const { status, priority } = req.query as { status?: string; priority?: string };
    const tickets = await db.select().from(positionTicketsTable)
      .where(eq(positionTicketsTable.tenantId, req.user!.tenantId))
      .orderBy(desc(positionTicketsTable.updatedAt));

    let filtered = tickets;
    if (status) filtered = filtered.filter(t => t.status === status);
    if (priority) filtered = filtered.filter(t => t.priority === priority);

    const enriched = filtered.map(t => ({ ...t, sla: calcSla(t) }));
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Server error" });
  }
});

router.post("/enterprise/tickets", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const { title, jobDescriptionId, priority, status, department, location, salaryRange, openings, targetStartDate, description, tags } = req.body as {
      title: string; jobDescriptionId?: number; priority?: string; status?: string; department?: string; location?: string;
      salaryRange?: string; openings?: number; targetStartDate?: string; description?: string; tags?: string[];
    };

    if (!title?.trim()) { res.status(400).json({ error: "title is required" }); return; }
    if (priority && !TICKET_PRIORITIES.includes(priority as typeof TICKET_PRIORITIES[number])) {
      res.status(400).json({ error: `priority must be one of: ${TICKET_PRIORITIES.join(", ")}` }); return;
    }

    const [ticket] = await db.insert(positionTicketsTable).values({
      tenantId: req.user!.tenantId,
      title: title.trim(),
      jobDescriptionId: jobDescriptionId ?? null,
      status: status ?? "Draft",
      priority: priority ?? "Medium",
      assignedTo: "[]",
      department: department ?? null,
      location: location ?? null,
      salaryRange: salaryRange ?? null,
      openings: openings ?? 1,
      filled: 0,
      targetStartDate: targetStartDate ?? null,
      description: description ?? null,
      tags: JSON.stringify(tags ?? []),
      createdBy: req.user!.userId,
    }).returning();

    await logAction(req.user!.tenantId, req.user!.userId, "CREATE_TICKET", "position_ticket", ticket.id, { title, status: ticket.status });

    if (ticket.status === "Open") {
      emitWebhookEvent(req.user!.tenantId, "position.opened", { positionId: ticket.id, title: ticket.title, priority: ticket.priority });
    }

    res.status(201).json({ ...ticket, sla: calcSla(ticket) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Server error" });
  }
});

router.get("/enterprise/tickets/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const [ticket] = await db.select().from(positionTicketsTable)
      .where(and(eq(positionTicketsTable.id, id), eq(positionTicketsTable.tenantId, req.user!.tenantId)));
    if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }

    const [comments, history, candidates] = await Promise.all([
      db.select().from(ticketCommentsTable).where(eq(ticketCommentsTable.ticketId, id)).orderBy(ticketCommentsTable.createdAt),
      db.select().from(ticketHistoryTable).where(eq(ticketHistoryTable.ticketId, id)).orderBy(ticketHistoryTable.changedAt),
      db.select({ tc: ticketCandidatesTable, rp: { id: resumeProfilesTable.id, candidateName: resumeProfilesTable.candidateName, candidateEmail: resumeProfilesTable.candidateEmail, fileName: resumeProfilesTable.fileName, candidateType: resumeProfilesTable.candidateType } })
        .from(ticketCandidatesTable)
        .leftJoin(resumeProfilesTable, eq(ticketCandidatesTable.resumeProfileId, resumeProfilesTable.id))
        .where(eq(ticketCandidatesTable.ticketId, id)),
    ]);

    let jd = null;
    if (ticket.jobDescriptionId) {
      const [j] = await db.select({ id: jobDescriptionsTable.id, title: jobDescriptionsTable.title, company: jobDescriptionsTable.company, status: jobDescriptionsTable.status })
        .from(jobDescriptionsTable).where(eq(jobDescriptionsTable.id, ticket.jobDescriptionId));
      jd = j ?? null;
    }

    const activity = [
      ...comments.map(c => ({ type: "comment" as const, id: c.id, authorName: c.authorName, content: c.content, at: c.createdAt })),
      ...history.map(h => ({ type: "history" as const, id: h.id, authorName: h.authorName, field: h.field, oldValue: h.oldValue, newValue: h.newValue, at: h.changedAt })),
    ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

    res.json({ ticket: { ...ticket, sla: calcSla(ticket) }, jd, candidates: candidates.map(c => ({ ...c.tc, candidate: c.rp })), activity });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Server error" });
  }
});

router.patch("/enterprise/tickets/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const [existing] = await db.select().from(positionTicketsTable)
      .where(and(eq(positionTicketsTable.id, id), eq(positionTicketsTable.tenantId, req.user!.tenantId)));
    if (!existing) { res.status(404).json({ error: "Ticket not found" }); return; }

    const nullableTextFields = new Set(["department", "location", "salaryRange", "targetStartDate", "description", "jobDescriptionId"]);
    const fields = ["title", "priority", "department", "location", "salaryRange", "openings", "targetStartDate", "description", "jobDescriptionId"] as const;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    const authorName = req.user!.email;

    for (const field of fields) {
      if (req.body[field] === undefined) continue;
      const rawVal = req.body[field];
      const coerced = nullableTextFields.has(field) && (rawVal === "" || rawVal === null) ? null : rawVal;
      const existingVal = (existing as Record<string, unknown>)[field];
      const strCoerced = coerced == null ? "null" : String(coerced);
      const strExisting = existingVal == null ? "null" : String(existingVal);
      if (strCoerced !== strExisting) {
        updates[field] = coerced;
        await recordHistory(id, req.user!.userId, authorName, field, existingVal == null ? "" : String(existingVal), coerced == null ? "" : String(coerced));
      }
    }

    if (req.body.tags !== undefined) {
      updates.tags = JSON.stringify(Array.isArray(req.body.tags) ? req.body.tags : []);
    }
    if (req.body.assignedTo !== undefined) {
      updates.assignedTo = JSON.stringify(Array.isArray(req.body.assignedTo) ? req.body.assignedTo : []);
    }

    const [updated] = await db.update(positionTicketsTable).set(updates).where(eq(positionTicketsTable.id, id)).returning();
    res.json({ ...updated, sla: calcSla(updated) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Server error" });
  }
});

router.post("/enterprise/tickets/:id/status", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const { status, closeReason } = req.body as { status: string; closeReason?: string };

    if (!TICKET_STATUSES.includes(status as typeof TICKET_STATUSES[number])) {
      res.status(400).json({ error: `status must be one of: ${TICKET_STATUSES.join(", ")}` }); return;
    }

    const [existing] = await db.select().from(positionTicketsTable)
      .where(and(eq(positionTicketsTable.id, id), eq(positionTicketsTable.tenantId, req.user!.tenantId)));
    if (!existing) { res.status(404).json({ error: "Ticket not found" }); return; }

    const [updated] = await db.update(positionTicketsTable)
      .set({ status, closeReason: closeReason ?? null, updatedAt: new Date() })
      .where(eq(positionTicketsTable.id, id)).returning();

    await recordHistory(id, req.user!.userId, req.user!.email, "status", existing.status, status);
    await logAction(req.user!.tenantId, req.user!.userId, "UPDATE_TICKET_STATUS", "position_ticket", id, { from: existing.status, to: status });

    if (status === "Open" && existing.status === "Draft") {
      emitWebhookEvent(req.user!.tenantId, "position.opened", { positionId: id, title: updated.title, priority: updated.priority });
    }
    if (status === "Closed") {
      emitWebhookEvent(req.user!.tenantId, "position.closed", { positionId: id, title: updated.title, reason: closeReason ?? "Closed" });
    }

    res.json({ ...updated, sla: calcSla(updated) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Server error" });
  }
});

router.delete("/enterprise/tickets/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const [deleted] = await db.delete(positionTicketsTable)
      .where(and(eq(positionTicketsTable.id, id), eq(positionTicketsTable.tenantId, req.user!.tenantId))).returning();
    if (!deleted) { res.status(404).json({ error: "Ticket not found" }); return; }
    await logAction(req.user!.tenantId, req.user!.userId, "DELETE_TICKET", "position_ticket", id);
    res.sendStatus(204);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Server error" });
  }
});

router.post("/enterprise/tickets/:id/comments", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const { content } = req.body as { content: string };
    if (!content?.trim()) { res.status(400).json({ error: "content is required" }); return; }

    const [ticket] = await db.select({ id: positionTicketsTable.id })
      .from(positionTicketsTable)
      .where(and(eq(positionTicketsTable.id, id), eq(positionTicketsTable.tenantId, req.user!.tenantId)));
    if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }

    const [comment] = await db.insert(ticketCommentsTable).values({
      ticketId: id, userId: req.user!.userId, authorName: req.user!.email, content: content.trim(),
    }).returning();
    res.status(201).json(comment);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Server error" });
  }
});

router.delete("/enterprise/tickets/:id/comments/:commentId", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const ticketId = parseInt(req.params.id);
    const commentId = parseInt(req.params.commentId);
    const [deleted] = await db.delete(ticketCommentsTable)
      .where(and(eq(ticketCommentsTable.id, commentId), eq(ticketCommentsTable.ticketId, ticketId), eq(ticketCommentsTable.userId, req.user!.userId)))
      .returning();
    if (!deleted) { res.status(404).json({ error: "Comment not found or not yours" }); return; }
    res.sendStatus(204);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Server error" });
  }
});

router.post("/enterprise/tickets/:id/candidates", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const ticketId = parseInt(req.params.id);
    const { resumeProfileId, stage, note } = req.body as { resumeProfileId: number; stage?: string; note?: string };
    if (!resumeProfileId) { res.status(400).json({ error: "resumeProfileId is required" }); return; }

    const [existing] = await db.select({ id: ticketCandidatesTable.id })
      .from(ticketCandidatesTable)
      .where(and(eq(ticketCandidatesTable.ticketId, ticketId), eq(ticketCandidatesTable.resumeProfileId, resumeProfileId)));
    if (existing) { res.status(409).json({ error: "Candidate already linked to this ticket" }); return; }

    const [tc] = await db.insert(ticketCandidatesTable).values({
      ticketId, resumeProfileId, stage: stage ?? "Applied", note: note ?? null, addedBy: req.user!.userId,
    }).returning();
    res.status(201).json(tc);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Server error" });
  }
});

router.patch("/enterprise/tickets/:id/candidates/:tcId", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const tcId = parseInt(req.params.tcId);
    const { stage, note } = req.body as { stage?: string; note?: string };
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (stage) updates.stage = stage;
    if (note !== undefined) updates.note = note;
    const [updated] = await db.update(ticketCandidatesTable).set(updates).where(eq(ticketCandidatesTable.id, tcId)).returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Server error" });
  }
});

router.delete("/enterprise/tickets/:id/candidates/:tcId", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const tcId = parseInt(req.params.tcId);
    await db.delete(ticketCandidatesTable).where(eq(ticketCandidatesTable.id, tcId));
    res.sendStatus(204);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Server error" });
  }
});

router.get("/enterprise/tickets/workload/summary", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const tickets = await db.select({
      id: positionTicketsTable.id,
      title: positionTicketsTable.title,
      status: positionTicketsTable.status,
      priority: positionTicketsTable.priority,
      assignedTo: positionTicketsTable.assignedTo,
      targetStartDate: positionTicketsTable.targetStartDate,
      createdAt: positionTicketsTable.createdAt,
    }).from(positionTicketsTable)
      .where(and(eq(positionTicketsTable.tenantId, req.user!.tenantId)));

    const open = tickets.filter(t => !["Draft", "Closed"].includes(t.status));
    const byRecruiter: Record<string, { assignee: string; tickets: typeof open; breached: number; warning: number; ok: number }> = {};

    for (const t of open) {
      const assignees: string[] = JSON.parse(t.assignedTo);
      const sla = calcSla(t);
      const targets = assignees.length > 0 ? assignees : ["Unassigned"];
      for (const assignee of targets) {
        if (!byRecruiter[assignee]) byRecruiter[assignee] = { assignee, tickets: [], breached: 0, warning: 0, ok: 0 };
        byRecruiter[assignee].tickets.push(t);
        if (sla.slaStatus === "breached") byRecruiter[assignee].breached++;
        else if (sla.slaStatus === "critical" || sla.slaStatus === "warning") byRecruiter[assignee].warning++;
        else byRecruiter[assignee].ok++;
      }
    }

    const statusCounts = TICKET_STATUSES.reduce((acc, s) => ({ ...acc, [s]: tickets.filter(t => t.status === s).length }), {} as Record<string, number>);

    res.json({
      totalTickets: tickets.length,
      openTickets: open.length,
      statusCounts,
      workload: Object.values(byRecruiter).sort((a, b) => b.tickets.length - a.tickets.length),
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Server error" });
  }
});

export default router;
