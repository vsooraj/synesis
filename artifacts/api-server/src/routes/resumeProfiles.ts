import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import multer from "multer";
import { db, resumeProfilesTable, resumeChunksTable } from "@workspace/db";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { logAction } from "../lib/audit.js";
import { openai } from "@workspace/integrations-openai-ai-server";
import { chunkResume } from "../lib/chunker.js";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

function sanitizeText(raw: string): string {
  return raw
    .replace(/\0/g, "")
    .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function generateEmbedding(text: string): Promise<string | null> {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text.slice(0, 8000),
    });
    const vec = response.data[0]?.embedding;
    if (!vec) return null;
    return JSON.stringify(vec);
  } catch {
    return null;
  }
}

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  // Import the internal lib file directly to avoid pdf-parse's test fixture initialization
  const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default;
  const result = await pdfParse(buffer);
  if (!result?.text) throw new Error("PDF yielded no extractable text");
  return sanitizeText(result.text);
}

router.post(
  "/enterprise/resumes",
  requireAuth,
  upload.single("file"),
  async (req: AuthRequest, res): Promise<void> => {
    try {
      let extractedText = "";
      let fileName: string | undefined;

      if (req.file) {
        fileName = req.file.originalname;
        const mime = req.file.mimetype;
        if (mime === "application/pdf" || fileName.toLowerCase().endsWith(".pdf")) {
          try {
            extractedText = await extractTextFromPdf(req.file.buffer);
          } catch (e) {
            res.status(422).json({ error: `PDF parsing failed: ${e instanceof Error ? e.message : "unknown error"}. Try uploading as a .txt file instead.` });
            return;
          }
        } else {
          extractedText = sanitizeText(req.file.buffer.toString("utf-8"));
        }
      } else if (req.body?.resumeText) {
        extractedText = sanitizeText(String(req.body.resumeText));
      } else {
        res.status(400).json({ error: "Either a file upload or resumeText is required" });
        return;
      }

      if (!extractedText || extractedText.length < 20) {
        res.status(422).json({ error: "Could not extract meaningful text from the file. Please paste the resume text directly." });
        return;
      }

      const embedding = await generateEmbedding(extractedText);

      const candidateName = req.body?.candidateName ? String(req.body.candidateName) : null;
      const candidateEmail = req.body?.candidateEmail ? String(req.body.candidateEmail) : null;
      const candidateType = (req.body?.candidateType as string) || "External";
      const userIdRaw = req.body?.userId;
      const userId = userIdRaw ? parseInt(String(userIdRaw), 10) : req.user!.userId;

      const [profile] = await db.insert(resumeProfilesTable).values({
        tenantId: req.user!.tenantId,
        userId,
        candidateType,
        fileName: fileName ?? null,
        candidateName,
        candidateEmail,
        extractedText,
        embedding,
      }).returning();

      const chunks = chunkResume(extractedText);
      if (chunks.length > 0) {
        await db.insert(resumeChunksTable).values(
          chunks.map(c => ({ resumeProfileId: profile.id, tenantId: req.user!.tenantId, section: c.section, chunkText: c.chunkText }))
        );
      }

      await logAction(req.user!.tenantId, req.user!.userId, "UPLOAD_RESUME", "resume_profile", profile.id, { fileName, candidateName, chunks: chunks.length });
      res.status(201).json({ ...profile, chunksIndexed: chunks.length });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unexpected server error";
      res.status(500).json({ error: message });
    }
  }
);

router.get("/enterprise/resumes", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
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
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Server error" });
  }
});

router.get("/enterprise/resumes/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const [profile] = await db.select().from(resumeProfilesTable)
      .where(and(eq(resumeProfilesTable.id, id), eq(resumeProfilesTable.tenantId, req.user!.tenantId)));
    if (!profile) { res.status(404).json({ error: "Resume profile not found" }); return; }
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Server error" });
  }
});

router.delete("/enterprise/resumes/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const [deleted] = await db.delete(resumeProfilesTable)
      .where(and(eq(resumeProfilesTable.id, id), eq(resumeProfilesTable.tenantId, req.user!.tenantId)))
      .returning();
    if (!deleted) { res.status(404).json({ error: "Resume profile not found" }); return; }
    await logAction(req.user!.tenantId, req.user!.userId, "DELETE_RESUME", "resume_profile", id);
    res.sendStatus(204);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Server error" });
  }
});

export default router;
