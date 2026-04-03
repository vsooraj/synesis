import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, jobDescriptionsTable } from "@workspace/db";
import { requireAuth, requireRole, type AuthRequest } from "../middleware/auth.js";
import { logAction } from "../lib/audit.js";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

async function generateEmbedding(text: string): Promise<string> {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text.slice(0, 8000),
    });
    return JSON.stringify(response.data[0].embedding);
  } catch {
    return "";
  }
}

router.post("/enterprise/jobs", requireAuth, requireRole("super_admin", "hr_admin", "hiring_manager"), async (req: AuthRequest, res): Promise<void> => {
  const { title, company, descriptionText, status } = req.body;
  if (!title || !descriptionText) {
    res.status(400).json({ error: "title and descriptionText are required" });
    return;
  }

  const embedding = await generateEmbedding(descriptionText);

  const [jd] = await db.insert(jobDescriptionsTable).values({
    tenantId: req.user!.tenantId,
    createdBy: req.user!.userId,
    title,
    company: company || null,
    descriptionText,
    status: status || "Draft",
    embedding: embedding || null,
  }).returning();

  await logAction(req.user!.tenantId, req.user!.userId, "CREATE_JD", "job_description", jd.id, { title });
  res.status(201).json(jd);
});

router.get("/enterprise/jobs", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const jds = await db.select({
    id: jobDescriptionsTable.id,
    title: jobDescriptionsTable.title,
    company: jobDescriptionsTable.company,
    status: jobDescriptionsTable.status,
    createdBy: jobDescriptionsTable.createdBy,
    createdAt: jobDescriptionsTable.createdAt,
  }).from(jobDescriptionsTable)
    .where(eq(jobDescriptionsTable.tenantId, req.user!.tenantId));
  res.json(jds);
});

router.get("/enterprise/jobs/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const [jd] = await db.select().from(jobDescriptionsTable)
    .where(and(eq(jobDescriptionsTable.id, id), eq(jobDescriptionsTable.tenantId, req.user!.tenantId)));

  if (!jd) {
    res.status(404).json({ error: "Job description not found" });
    return;
  }
  res.json(jd);
});

router.put("/enterprise/jobs/:id", requireAuth, requireRole("super_admin", "hr_admin", "hiring_manager"), async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const { title, company, descriptionText, status } = req.body;

  const updates: Partial<typeof jobDescriptionsTable.$inferInsert> = { updatedAt: new Date() };
  if (title) updates.title = title;
  if (company !== undefined) updates.company = company;
  if (descriptionText) {
    updates.descriptionText = descriptionText;
    updates.embedding = await generateEmbedding(descriptionText) || null;
  }
  if (status) updates.status = status;

  const [updated] = await db.update(jobDescriptionsTable)
    .set(updates)
    .where(and(eq(jobDescriptionsTable.id, id), eq(jobDescriptionsTable.tenantId, req.user!.tenantId)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Job description not found" });
    return;
  }

  await logAction(req.user!.tenantId, req.user!.userId, "UPDATE_JD", "job_description", id, { status });
  res.json(updated);
});

router.delete("/enterprise/jobs/:id", requireAuth, requireRole("super_admin", "hr_admin"), async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const [deleted] = await db.delete(jobDescriptionsTable)
    .where(and(eq(jobDescriptionsTable.id, id), eq(jobDescriptionsTable.tenantId, req.user!.tenantId)))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Job description not found" });
    return;
  }

  await logAction(req.user!.tenantId, req.user!.userId, "DELETE_JD", "job_description", id);
  res.sendStatus(204);
});

export default router;
