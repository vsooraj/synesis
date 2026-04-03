import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, shortlistJobsTable, shortlistResultsTable, resumeProfilesTable, jobDescriptionsTable } from "@workspace/db";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { logAction } from "../lib/audit.js";
import { openai } from "@workspace/integrations-openai-ai-server";
import { cosineSimilarity, tokenize, tfidfScore, buildIdf } from "./talentSearch.js";

const router: IRouter = Router();

async function analyzeCandidate(resumeText: string, jdText: string, jdTitle: string): Promise<{ score: number; summary: string; strengths: string[]; gaps: string[] } | null> {
  try {
    const prompt = `You are an expert recruiter. Score the resume against the job description on a scale of 0-100.

JOB TITLE: ${jdTitle}
JOB DESCRIPTION:
${jdText.slice(0, 3000)}

RESUME:
${resumeText.slice(0, 3000)}

Respond with ONLY valid JSON (no markdown):
{
  "score": <integer 0-100>,
  "summary": "<2-sentence assessment>",
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "gaps": ["<gap 1>", "<gap 2>"]
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-5.2",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
    });

    const text = response.choices[0]?.message?.content ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    return JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
}

function generateReport(
  jdTitle: string,
  jdCompany: string | null,
  results: Array<{ candidateName: string | null; candidateEmail: string | null; overallScore: number; summary: string; strengths: string[]; gaps: string[]; similarityScore: number }>,
  threshold: number
): string {
  const date = new Date().toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" });
  const passing = results.filter(r => r.overallScore >= threshold);

  let md = `# Shortlist Report — ${jdTitle}`;
  if (jdCompany) md += ` @ ${jdCompany}`;
  md += `\n\n**Generated:** ${date}\n**Score Threshold:** ${threshold}/100\n**Candidates Shortlisted:** ${passing.length}\n\n---\n\n`;

  if (passing.length === 0) {
    md += `> No candidates scored above the threshold of ${threshold}. Consider lowering the threshold or expanding the candidate pool.\n`;
    return md;
  }

  md += `## Shortlisted Candidates\n\n`;
  passing.forEach((r, i) => {
    const name = r.candidateName || "Unknown Candidate";
    const email = r.candidateEmail ? ` (${r.candidateEmail})` : "";
    md += `### ${i + 1}. ${name}${email}\n`;
    md += `**AI Score:** ${r.overallScore}/100 &nbsp;|&nbsp; **Semantic Similarity:** ${r.similarityScore.toFixed(1)}%\n\n`;
    md += `**Assessment:** ${r.summary}\n\n`;
    if (r.strengths?.length) md += `**Strengths:** ${r.strengths.join(", ")}\n\n`;
    if (r.gaps?.length) md += `**Gaps:** ${r.gaps.join(", ")}\n\n`;
    md += `---\n\n`;
  });

  if (results.length > passing.length) {
    md += `## Below Threshold (${results.length - passing.length} candidates)\n\n`;
    results.filter(r => r.overallScore < threshold).forEach(r => {
      md += `- ${r.candidateName || "Unknown"} — Score: ${r.overallScore}/100\n`;
    });
  }

  return md;
}

async function runAgentPipeline(jobId: number, tenantId: number, userId: number): Promise<void> {
  const appendLog = async (msg: string) => {
    const [current] = await db.select({ agentLog: shortlistJobsTable.agentLog })
      .from(shortlistJobsTable).where(eq(shortlistJobsTable.id, jobId));
    const logs = [...((current?.agentLog as string[]) || []), `[${new Date().toISOString()}] ${msg}`];
    await db.update(shortlistJobsTable).set({ agentLog: logs }).where(eq(shortlistJobsTable.id, jobId));
  };

  try {
    const [job] = await db.select().from(shortlistJobsTable).where(eq(shortlistJobsTable.id, jobId));
    if (!job) return;

    await db.update(shortlistJobsTable).set({ status: "Running" }).where(eq(shortlistJobsTable.id, jobId));
    await appendLog("Agent started");

    const [jd] = await db.select().from(jobDescriptionsTable).where(eq(jobDescriptionsTable.id, job.jobDescriptionId));
    if (!jd) throw new Error("Job description not found");
    await appendLog(`Loaded JD: "${jd.title}"`);

    const allProfiles = await db.select({
      id: resumeProfilesTable.id,
      candidateName: resumeProfilesTable.candidateName,
      candidateEmail: resumeProfilesTable.candidateEmail,
      extractedText: resumeProfilesTable.extractedText,
    }).from(resumeProfilesTable).where(eq(resumeProfilesTable.tenantId, tenantId));

    await appendLog(`Searching ${allProfiles.length} candidates in talent pool using TF-IDF similarity`);

    const jdTokens = tokenize(jd.descriptionText);
    const docTokenArrays = allProfiles.map(p => tokenize(p.extractedText));
    const idfMap = buildIdf(jdTokens, docTokenArrays);

    const ranked = allProfiles
      .map((p, i) => ({
        id: p.id,
        candidateName: p.candidateName,
        candidateEmail: p.candidateEmail,
        extractedText: p.extractedText,
        similarityScore: Math.min(100, Math.round(tfidfScore(jdTokens, docTokenArrays[i], idfMap) * 1000)),
      }))
      .sort((a, b) => b.similarityScore - a.similarityScore);

    const topCandidates = ranked.slice(0, job.maxCandidates);
    await appendLog(`Selected top ${topCandidates.length} candidates by semantic similarity`);
    await db.update(shortlistJobsTable).set({ totalSearched: topCandidates.length }).where(eq(shortlistJobsTable.id, jobId));

    const analysisResults: Array<{ candidateName: string | null; candidateEmail: string | null; resumeProfileId: number; overallScore: number; summary: string; strengths: string[]; gaps: string[]; similarityScore: number }> = [];

    for (let i = 0; i < topCandidates.length; i++) {
      const candidate = topCandidates[i];
      await appendLog(`Analyzing candidate ${i + 1}/${topCandidates.length}: ${candidate.candidateName || "Unknown"}`);

      const analysis = await analyzeCandidate(candidate.extractedText, jd.descriptionText, jd.title);
      const score = analysis?.score ?? 0;
      const summary = analysis?.summary ?? "Analysis unavailable";
      const strengths = analysis?.strengths ?? [];
      const gaps = analysis?.gaps ?? [];

      await db.insert(shortlistResultsTable).values({
        shortlistJobId: jobId,
        resumeProfileId: candidate.id,
        similarityScore: candidate.similarityScore,
        overallScore: score,
        summary,
        strengths,
        gaps,
        included: score >= job.scoreThreshold ? "yes" : "no",
      });

      analysisResults.push({
        candidateName: candidate.candidateName,
        candidateEmail: candidate.candidateEmail,
        resumeProfileId: candidate.id,
        overallScore: score,
        summary,
        strengths,
        gaps,
        similarityScore: candidate.similarityScore,
      });
    }

    await appendLog("All candidates analyzed — generating report");

    const sorted = [...analysisResults].sort((a, b) => b.overallScore - a.overallScore);
    const passing = sorted.filter(r => r.overallScore >= job.scoreThreshold);
    const report = generateReport(jd.title, jd.company, sorted, job.scoreThreshold);

    await db.update(shortlistJobsTable).set({
      status: "Pending Approval",
      totalShortlisted: passing.length,
      reportMarkdown: report,
      completedAt: new Date(),
    }).where(eq(shortlistJobsTable.id, jobId));

    await appendLog(`Pipeline complete — ${passing.length} candidates shortlisted. Awaiting HR approval.`);
    await logAction(tenantId, userId, "AGENT_SHORTLIST_COMPLETE", "shortlist_job", jobId, { shortlisted: passing.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await db.update(shortlistJobsTable).set({ status: "Failed" }).where(eq(shortlistJobsTable.id, jobId));
    const [current] = await db.select({ agentLog: shortlistJobsTable.agentLog }).from(shortlistJobsTable).where(eq(shortlistJobsTable.id, jobId));
    const logs = [...((current?.agentLog as string[]) || []), `[${new Date().toISOString()}] ERROR: ${message}`];
    await db.update(shortlistJobsTable).set({ agentLog: logs }).where(eq(shortlistJobsTable.id, jobId));
  }
}

router.post("/enterprise/agent/shortlists", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const { jobDescriptionId, scoreThreshold = 70, maxCandidates = 50 } = req.body as { jobDescriptionId: number; scoreThreshold?: number; maxCandidates?: number };
    if (!jobDescriptionId) { res.status(400).json({ error: "jobDescriptionId is required" }); return; }

    const [jd] = await db.select({ id: jobDescriptionsTable.id }).from(jobDescriptionsTable)
      .where(and(eq(jobDescriptionsTable.id, jobDescriptionId), eq(jobDescriptionsTable.tenantId, req.user!.tenantId)));
    if (!jd) { res.status(404).json({ error: "Job description not found" }); return; }

    const [job] = await db.insert(shortlistJobsTable).values({
      tenantId: req.user!.tenantId,
      createdBy: req.user!.userId,
      jobDescriptionId,
      scoreThreshold,
      maxCandidates,
      status: "Pending",
      totalSearched: 0,
      totalShortlisted: 0,
      agentLog: [],
    }).returning();

    await logAction(req.user!.tenantId, req.user!.userId, "START_AGENT_SHORTLIST", "shortlist_job", job.id, { jobDescriptionId, scoreThreshold });
    setTimeout(() => runAgentPipeline(job.id, req.user!.tenantId, req.user!.userId), 100);
    res.status(201).json(job);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Server error" });
  }
});

router.get("/enterprise/agent/shortlists", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const jobs = await db.select({
      id: shortlistJobsTable.id,
      status: shortlistJobsTable.status,
      scoreThreshold: shortlistJobsTable.scoreThreshold,
      maxCandidates: shortlistJobsTable.maxCandidates,
      totalSearched: shortlistJobsTable.totalSearched,
      totalShortlisted: shortlistJobsTable.totalShortlisted,
      jobDescriptionId: shortlistJobsTable.jobDescriptionId,
      createdBy: shortlistJobsTable.createdBy,
      createdAt: shortlistJobsTable.createdAt,
      completedAt: shortlistJobsTable.completedAt,
      approvedAt: shortlistJobsTable.approvedAt,
    }).from(shortlistJobsTable)
      .where(eq(shortlistJobsTable.tenantId, req.user!.tenantId));
    res.json(jobs);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Server error" });
  }
});

router.get("/enterprise/agent/shortlists/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const [job] = await db.select().from(shortlistJobsTable)
      .where(and(eq(shortlistJobsTable.id, id), eq(shortlistJobsTable.tenantId, req.user!.tenantId)));
    if (!job) { res.status(404).json({ error: "Shortlist job not found" }); return; }

    const results = await db.select({
      id: shortlistResultsTable.id,
      resumeProfileId: shortlistResultsTable.resumeProfileId,
      similarityScore: shortlistResultsTable.similarityScore,
      overallScore: shortlistResultsTable.overallScore,
      summary: shortlistResultsTable.summary,
      strengths: shortlistResultsTable.strengths,
      gaps: shortlistResultsTable.gaps,
      included: shortlistResultsTable.included,
    }).from(shortlistResultsTable)
      .where(eq(shortlistResultsTable.shortlistJobId, id));

    const profileIds = [...new Set(results.map(r => r.resumeProfileId))];
    const profiles = profileIds.length > 0
      ? await db.select({ id: resumeProfilesTable.id, candidateName: resumeProfilesTable.candidateName, candidateEmail: resumeProfilesTable.candidateEmail, fileName: resumeProfilesTable.fileName, candidateType: resumeProfilesTable.candidateType })
          .from(resumeProfilesTable)
          .where(eq(resumeProfilesTable.tenantId, req.user!.tenantId))
      : [];

    const profileMap = Object.fromEntries(profiles.map(p => [p.id, p]));
    const enriched = results.map(r => ({ ...r, candidate: profileMap[r.resumeProfileId] ?? null }))
      .sort((a, b) => (b.overallScore ?? 0) - (a.overallScore ?? 0));

    res.json({ job, results: enriched });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Server error" });
  }
});

router.post("/enterprise/agent/shortlists/:id/approve", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const { note } = req.body as { note?: string };
    const [job] = await db.select({ status: shortlistJobsTable.status })
      .from(shortlistJobsTable)
      .where(and(eq(shortlistJobsTable.id, id), eq(shortlistJobsTable.tenantId, req.user!.tenantId)));
    if (!job) { res.status(404).json({ error: "Shortlist job not found" }); return; }
    if (job.status !== "Pending Approval") { res.status(400).json({ error: `Cannot approve a job with status "${job.status}"` }); return; }

    const [updated] = await db.update(shortlistJobsTable).set({
      status: "Approved",
      approvedBy: req.user!.userId,
      approvalNote: note || null,
      approvedAt: new Date(),
    }).where(eq(shortlistJobsTable.id, id)).returning();

    await logAction(req.user!.tenantId, req.user!.userId, "APPROVE_SHORTLIST", "shortlist_job", id, { note });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Server error" });
  }
});

router.post("/enterprise/agent/shortlists/:id/reject", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const { note } = req.body as { note?: string };
    const [job] = await db.select({ status: shortlistJobsTable.status })
      .from(shortlistJobsTable)
      .where(and(eq(shortlistJobsTable.id, id), eq(shortlistJobsTable.tenantId, req.user!.tenantId)));
    if (!job) { res.status(404).json({ error: "Shortlist job not found" }); return; }
    if (job.status !== "Pending Approval") { res.status(400).json({ error: `Cannot reject a job with status "${job.status}"` }); return; }

    const [updated] = await db.update(shortlistJobsTable).set({
      status: "Rejected",
      approvedBy: req.user!.userId,
      approvalNote: note || null,
      approvedAt: new Date(),
    }).where(eq(shortlistJobsTable.id, id)).returning();

    await logAction(req.user!.tenantId, req.user!.userId, "REJECT_SHORTLIST", "shortlist_job", id, { note });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Server error" });
  }
});

export default router;
