import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import multer from "multer";
import { db, resumeProfilesTable } from "@workspace/db";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { logAction } from "../lib/audit.js";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

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

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  try {
    const pdfParse = (await import("pdf-parse")).default;
    const result = await pdfParse(buffer);
    return result.text;
  } catch {
    return buffer.toString("utf-8");
  }
}

router.post("/enterprise/resumes", requireAuth, upload.single("file"), async (req: AuthRequest, res): Promise<void> => {
  let extractedText = "";
  let fileName: string | undefined;

  if (req.file) {
    fileName = req.file.originalname;
    if (req.file.mimetype === "application/pdf") {
      extractedText = await extractTextFromPdf(req.file.buffer);
    } else {
      extractedText = req.file.buffer.toString("utf-8");
    }
  } else if (req.body.resumeText) {
    extractedText = req.body.resumeText;
  } else {
    res.status(400).json({ error: "Either file upload or resumeText is required" });
    return;
  }

  if (!extractedText.trim()) {
    res.status(400).json({ error: "Could not extract text from the provided file" });
    return;
  }

  const embedding = await generateEmbedding(extractedText);

  const [profile] = await db.insert(resumeProfilesTable).values({
    tenantId: req.user!.tenantId,
    userId: req.body.userId ? parseInt(req.body.userId) : req.user!.userId,
    candidateType: req.body.candidateType || "External",
    fileName,
    candidateName: req.body.candidateName,
    candidateEmail: req.body.candidateEmail,
    extractedText,
    embedding: embedding || null,
  }).returning();

  await logAction(req.user!.tenantId, req.user!.userId, "UPLOAD_RESUME", "resume_profile", profile.id, { fileName, candidateName: req.body.candidateName });
  res.status(201).json(profile);
});

router.get("/enterprise/resumes", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const profiles = await db.select({
    id: resumeProfilesTable.id,
    candidateType: resumeProfilesTable.candidateType,
    fileName: resumeProfilesTable.fileName,
    candidateName: resumeProfilesTable.candidateName,
    candidateEmail: resumeProfilesTable.candidateEmail,
    createdAt: resumeProfilesTable.createdAt,
  }).from(resumeProfilesTable)
    .where(eq(resumeProfilesTable.tenantId, req.user!.tenantId));
  res.json(profiles);
});

router.get("/enterprise/resumes/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const [profile] = await db.select().from(resumeProfilesTable)
    .where(and(eq(resumeProfilesTable.id, id), eq(resumeProfilesTable.tenantId, req.user!.tenantId)));

  if (!profile) {
    res.status(404).json({ error: "Resume profile not found" });
    return;
  }
  res.json(profile);
});

router.delete("/enterprise/resumes/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const [deleted] = await db.delete(resumeProfilesTable)
    .where(and(eq(resumeProfilesTable.id, id), eq(resumeProfilesTable.tenantId, req.user!.tenantId)))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Resume profile not found" });
    return;
  }

  await logAction(req.user!.tenantId, req.user!.userId, "DELETE_RESUME", "resume_profile", id);
  res.sendStatus(204);
});

export default router;
