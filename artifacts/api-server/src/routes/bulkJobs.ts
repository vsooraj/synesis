import { Router, type IRouter } from "express";
import { eq, and, inArray } from "drizzle-orm";
import { db, bulkJobsTable, bulkJobResultsTable, resumeProfilesTable, jobDescriptionsTable, analysesTable } from "@workspace/db";
import { requireAuth, requireRole, type AuthRequest } from "../middleware/auth.js";
import { logAction } from "../lib/audit.js";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

const AI_SYSTEM_PROMPT = `You are an expert resume analyst. Analyze the resume against the job description and return ONLY a JSON object with this exact structure:
{
  "overallScore": <number 0-100>,
  "summary": "<2-3 sentence assessment>",
  "strengths": ["<strength>"],
  "gaps": ["<gap>"],
  "matchedKeywords": [{"keyword": "<kw>", "found": true, "importance": "high|medium|low"}],
  "missingKeywords": ["<kw>"],
  "suggestions": ["<suggestion>"],
  "sectionScores": {"skills": <0-100>, "experience": <0-100>, "education": <0-100>, "keywords": <0-100>}
}`;

async function runAnalysis(resumeText: string, jobDescription: string, jobTitle: string, tenantId: number, userId: number | null, resumeProfileId: number, jobDescriptionId: number) {
  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    max_completion_tokens: 4096,
    messages: [
      { role: "system", content: AI_SYSTEM_PROMPT },
      { role: "user", content: `RESUME:\n${resumeText}\n\nJOB DESCRIPTION:\n${jobDescription}\n\nReturn JSON only.` },
    ],
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("No AI response");

  const aiResult = JSON.parse(content);
  const [analysis] = await db.insert(analysesTable).values({
    jobTitle,
    resumeText,
    jobDescription,
    overallScore: aiResult.overallScore,
    summary: aiResult.summary,
    strengths: aiResult.strengths,
    gaps: aiResult.gaps,
    matchedKeywords: aiResult.matchedKeywords,
    missingKeywords: aiResult.missingKeywords,
    suggestions: aiResult.suggestions,
    sectionScores: aiResult.sectionScores,
  }).returning();

  return analysis.id;
}

async function processBulkJob(jobId: number) {
  const [job] = await db.select().from(bulkJobsTable).where(eq(bulkJobsTable.id, jobId));
  if (!job || job.status !== "Pending") return;

  await db.update(bulkJobsTable).set({ status: "Running" }).where(eq(bulkJobsTable.id, jobId));

  const [jd] = await db.select().from(jobDescriptionsTable).where(eq(jobDescriptionsTable.id, job.jobDescriptionId));
  if (!jd) {
    await db.update(bulkJobsTable).set({ status: "Failed" }).where(eq(bulkJobsTable.id, jobId));
    return;
  }

  const profileIds = job.resumeProfileIds as number[];
  const profiles = await db.select().from(resumeProfilesTable).where(inArray(resumeProfilesTable.id, profileIds));

  let processed = 0;
  let failed = 0;

  for (const profile of profiles) {
    const [resultRow] = await db.select().from(bulkJobResultsTable)
      .where(and(eq(bulkJobResultsTable.bulkJobId, jobId), eq(bulkJobResultsTable.resumeProfileId, profile.id)));

    if (!resultRow) continue;

    try {
      const analysisId = await runAnalysis(
        profile.extractedText,
        jd.descriptionText,
        jd.title,
        job.tenantId,
        job.createdBy,
        profile.id,
        jd.id,
      );

      await db.update(bulkJobResultsTable)
        .set({ status: "Complete", analysisId })
        .where(eq(bulkJobResultsTable.id, resultRow.id));

      processed++;
    } catch (err) {
      await db.update(bulkJobResultsTable)
        .set({ status: "Failed", error: err instanceof Error ? err.message : "Unknown error" })
        .where(eq(bulkJobResultsTable.id, resultRow.id));
      failed++;
    }

    await db.update(bulkJobsTable).set({ processed, failed }).where(eq(bulkJobsTable.id, jobId));
  }

  await db.update(bulkJobsTable)
    .set({ status: "Complete", processed, failed, completedAt: new Date() })
    .where(eq(bulkJobsTable.id, jobId));
}

router.post("/enterprise/bulk-jobs", requireAuth, requireRole("super_admin", "hr_admin", "recruiter"), async (req: AuthRequest, res): Promise<void> => {
  const { jobDescriptionId, resumeProfileIds } = req.body;
  if (!jobDescriptionId || !resumeProfileIds?.length) {
    res.status(400).json({ error: "jobDescriptionId and resumeProfileIds are required" });
    return;
  }

  const [job] = await db.insert(bulkJobsTable).values({
    tenantId: req.user!.tenantId,
    createdBy: req.user!.userId,
    jobDescriptionId,
    status: "Pending",
    total: resumeProfileIds.length,
    processed: 0,
    failed: 0,
    resumeProfileIds,
  }).returning();

  const resultRows = resumeProfileIds.map((id: number) => ({
    bulkJobId: job.id,
    resumeProfileId: id,
    status: "Pending",
  }));
  await db.insert(bulkJobResultsTable).values(resultRows);

  await logAction(req.user!.tenantId, req.user!.userId, "SUBMIT_BULK_JOB", "bulk_job", job.id, { jobDescriptionId, count: resumeProfileIds.length });

  // Fire-and-forget background processing
  setTimeout(() => processBulkJob(job.id).catch(console.error), 100);

  res.status(201).json(job);
});

router.get("/enterprise/bulk-jobs", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const jobs = await db.select().from(bulkJobsTable)
    .where(eq(bulkJobsTable.tenantId, req.user!.tenantId));
  res.json(jobs);
});

router.get("/enterprise/bulk-jobs/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const [job] = await db.select().from(bulkJobsTable)
    .where(and(eq(bulkJobsTable.id, id), eq(bulkJobsTable.tenantId, req.user!.tenantId)));

  if (!job) {
    res.status(404).json({ error: "Bulk job not found" });
    return;
  }

  const results = await db.select({
    id: bulkJobResultsTable.id,
    resumeProfileId: bulkJobResultsTable.resumeProfileId,
    analysisId: bulkJobResultsTable.analysisId,
    status: bulkJobResultsTable.status,
    error: bulkJobResultsTable.error,
    overallScore: analysesTable.overallScore,
    summary: analysesTable.summary,
  }).from(bulkJobResultsTable)
    .leftJoin(analysesTable, eq(bulkJobResultsTable.analysisId, analysesTable.id))
    .where(eq(bulkJobResultsTable.bulkJobId, id));

  const profileIds = results.map(r => r.resumeProfileId);
  let profiles: Array<{ id: number; candidateName: string | null; candidateEmail: string | null; fileName: string | null }> = [];
  if (profileIds.length > 0) {
    profiles = await db.select({
      id: resumeProfilesTable.id,
      candidateName: resumeProfilesTable.candidateName,
      candidateEmail: resumeProfilesTable.candidateEmail,
      fileName: resumeProfilesTable.fileName,
    }).from(resumeProfilesTable).where(inArray(resumeProfilesTable.id, profileIds));
  }

  const enriched = results.map(r => ({
    ...r,
    candidate: profiles.find(p => p.id === r.resumeProfileId),
  })).sort((a, b) => (b.overallScore ?? 0) - (a.overallScore ?? 0));

  res.json({ job, results: enriched });
});

router.get("/enterprise/bulk-jobs/:id/export", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const [job] = await db.select().from(bulkJobsTable)
    .where(and(eq(bulkJobsTable.id, id), eq(bulkJobsTable.tenantId, req.user!.tenantId)));

  if (!job) {
    res.status(404).json({ error: "Bulk job not found" });
    return;
  }

  const results = await db.select({
    resumeProfileId: bulkJobResultsTable.resumeProfileId,
    status: bulkJobResultsTable.status,
    overallScore: analysesTable.overallScore,
    summary: analysesTable.summary,
    candidateName: resumeProfilesTable.candidateName,
    candidateEmail: resumeProfilesTable.candidateEmail,
  }).from(bulkJobResultsTable)
    .leftJoin(analysesTable, eq(bulkJobResultsTable.analysisId, analysesTable.id))
    .leftJoin(resumeProfilesTable, eq(bulkJobResultsTable.resumeProfileId, resumeProfilesTable.id))
    .where(eq(bulkJobResultsTable.bulkJobId, id));

  const sorted = results.sort((a, b) => (b.overallScore ?? 0) - (a.overallScore ?? 0));
  const header = "Rank,Candidate Name,Email,Match Score,Status,Summary";
  const rows = sorted.map((r, i) => {
    const name = r.candidateName ?? "Unknown";
    const email = r.candidateEmail ?? "";
    const score = r.overallScore ?? "";
    const summary = (r.summary ?? "").replace(/,/g, ";").replace(/\n/g, " ");
    return `${i + 1},"${name}","${email}",${score},${r.status},"${summary}"`;
  });

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="bulk-job-${id}-results.csv"`);
  res.send([header, ...rows].join("\n"));
});

export default router;
