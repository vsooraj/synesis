import { Router, type IRouter } from "express";
import { eq, and, desc, sql } from "drizzle-orm";
import { db, departmentsTable, positionTicketsTable, jobDescriptionsTable } from "@workspace/db";
import { requireAuth, requireRole, type AuthRequest } from "../middleware/auth.js";
import { logAction } from "../lib/audit.js";

const router: IRouter = Router();

router.get("/enterprise/departments", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const departments = await db.select().from(departmentsTable)
      .where(eq(departmentsTable.tenantId, req.user!.tenantId))
      .orderBy(departmentsTable.name);

    const deptIds = departments.map(d => d.id);
    if (deptIds.length === 0) { res.json([]); return; }

    const openTickets = await db.select({
      departmentId: positionTicketsTable.departmentId,
      count: sql<number>`count(*)`,
    }).from(positionTicketsTable)
      .where(and(
        eq(positionTicketsTable.tenantId, req.user!.tenantId),
        sql`${positionTicketsTable.status} NOT IN ('Closed')`,
        sql`${positionTicketsTable.departmentId} IS NOT NULL`,
      ))
      .groupBy(positionTicketsTable.departmentId);

    const openMap: Record<number, number> = {};
    for (const row of openTickets) {
      if (row.departmentId) openMap[row.departmentId] = Number(row.count);
    }

    const jdCount = await db.select({
      departmentId: jobDescriptionsTable.departmentId,
      count: sql<number>`count(*)`,
    }).from(jobDescriptionsTable)
      .where(and(
        eq(jobDescriptionsTable.tenantId, req.user!.tenantId),
        sql`${jobDescriptionsTable.departmentId} IS NOT NULL`,
      ))
      .groupBy(jobDescriptionsTable.departmentId);

    const jdMap: Record<number, number> = {};
    for (const row of jdCount) {
      if (row.departmentId) jdMap[row.departmentId] = Number(row.count);
    }

    const enriched = departments.map(d => ({
      ...d,
      openPositions: openMap[d.id] ?? 0,
      jobDescriptions: jdMap[d.id] ?? 0,
    }));

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Server error" });
  }
});

router.post("/enterprise/departments", requireAuth, requireRole("super_admin", "hr_admin"), async (req: AuthRequest, res): Promise<void> => {
  try {
    const { name, description, headCount } = req.body as { name: string; description?: string; headCount?: number };
    if (!name?.trim()) { res.status(400).json({ error: "name is required" }); return; }

    const [dept] = await db.insert(departmentsTable).values({
      tenantId: req.user!.tenantId,
      name: name.trim(),
      description: description?.trim() || null,
      headCount: headCount ?? 0,
    }).returning();

    await logAction(req.user!.tenantId, req.user!.userId, "CREATE_DEPT", "department", dept.id, { name });
    res.status(201).json(dept);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Server error" });
  }
});

router.put("/enterprise/departments/:id", requireAuth, requireRole("super_admin", "hr_admin"), async (req: AuthRequest, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const { name, description, headCount } = req.body as { name?: string; description?: string; headCount?: number };

    const updates: Partial<typeof departmentsTable.$inferInsert> = { updatedAt: new Date() };
    if (name) updates.name = name.trim();
    if (description !== undefined) updates.description = description?.trim() || null;
    if (headCount !== undefined) updates.headCount = headCount;

    const [updated] = await db.update(departmentsTable)
      .set(updates)
      .where(and(eq(departmentsTable.id, id), eq(departmentsTable.tenantId, req.user!.tenantId)))
      .returning();

    if (!updated) { res.status(404).json({ error: "Department not found" }); return; }
    await logAction(req.user!.tenantId, req.user!.userId, "UPDATE_DEPT", "department", id, { name });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Server error" });
  }
});

router.delete("/enterprise/departments/:id", requireAuth, requireRole("super_admin", "hr_admin"), async (req: AuthRequest, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const [deleted] = await db.delete(departmentsTable)
      .where(and(eq(departmentsTable.id, id), eq(departmentsTable.tenantId, req.user!.tenantId)))
      .returning();

    if (!deleted) { res.status(404).json({ error: "Department not found" }); return; }
    await logAction(req.user!.tenantId, req.user!.userId, "DELETE_DEPT", "department", id, {});
    res.sendStatus(204);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Server error" });
  }
});

router.get("/enterprise/analytics/department-breakdown", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId;

    const departments = await db.select().from(departmentsTable)
      .where(eq(departmentsTable.tenantId, tenantId))
      .orderBy(departmentsTable.name);

    if (departments.length === 0) { res.json([]); return; }

    const ticketStats = await db.select({
      departmentId: positionTicketsTable.departmentId,
      status: positionTicketsTable.status,
      count: sql<number>`count(*)`,
    }).from(positionTicketsTable)
      .where(and(
        eq(positionTicketsTable.tenantId, tenantId),
        sql`${positionTicketsTable.departmentId} IS NOT NULL`,
      ))
      .groupBy(positionTicketsTable.departmentId, positionTicketsTable.status);

    const ticketMap: Record<number, Record<string, number>> = {};
    for (const row of ticketStats) {
      if (!row.departmentId) continue;
      if (!ticketMap[row.departmentId]) ticketMap[row.departmentId] = {};
      ticketMap[row.departmentId][row.status] = Number(row.count);
    }

    const jdStats = await db.select({
      departmentId: jobDescriptionsTable.departmentId,
      count: sql<number>`count(*)`,
    }).from(jobDescriptionsTable)
      .where(and(
        eq(jobDescriptionsTable.tenantId, tenantId),
        sql`${jobDescriptionsTable.departmentId} IS NOT NULL`,
      ))
      .groupBy(jobDescriptionsTable.departmentId);

    const jdMap: Record<number, number> = {};
    for (const row of jdStats) {
      if (row.departmentId) jdMap[row.departmentId] = Number(row.count);
    }

    const result = departments.map(d => {
      const statuses = ticketMap[d.id] ?? {};
      const totalPositions = Object.values(statuses).reduce((a, b) => a + b, 0);
      const openPositions = Object.entries(statuses)
        .filter(([s]) => s !== "Closed")
        .reduce((a, [, v]) => a + v, 0);
      const filledPositions = statuses["Closed"] ?? 0;
      return {
        id: d.id,
        name: d.name,
        headCount: d.headCount,
        totalPositions,
        openPositions,
        filledPositions,
        jobDescriptions: jdMap[d.id] ?? 0,
        statusBreakdown: statuses,
      };
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Server error" });
  }
});

export default router;
