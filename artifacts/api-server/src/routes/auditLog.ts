import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, auditLogTable } from "@workspace/db";
import { requireAuth, requireRole, type AuthRequest } from "../middleware/auth.js";

const router: IRouter = Router();

router.get("/enterprise/audit-log", requireAuth, requireRole("super_admin", "hr_admin"), async (req: AuthRequest, res): Promise<void> => {
  const limit = Math.min(parseInt(req.query.limit as string || "100"), 500);
  const logs = await db.select().from(auditLogTable)
    .where(eq(auditLogTable.tenantId, req.user!.tenantId))
    .orderBy(desc(auditLogTable.createdAt))
    .limit(limit);
  res.json(logs);
});

export default router;
