import { Router, type IRouter } from "express";
import { eq, avg, max, min, desc, count } from "drizzle-orm";
import { db, analysesTable } from "@workspace/db";
import {
  AnalyzeResumeBody,
  GetAnalysisParams,
  DeleteAnalysisParams,
} from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

router.post("/resume/analyze", async (req, res): Promise<void> => {
  const parsed = AnalyzeResumeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { resumeText, jobDescription, jobTitle, companyName } = parsed.data;

  const systemPrompt = `You are an expert resume analyst and career coach. Analyze the resume against the job description and provide detailed, actionable feedback. Be honest and specific.

Return a JSON object with EXACTLY this structure:
{
  "overallScore": <number 0-100>,
  "summary": "<2-3 sentence overall assessment>",
  "strengths": ["<strength 1>", "<strength 2>", ...],
  "gaps": ["<gap 1>", "<gap 2>", ...],
  "matchedKeywords": [
    {"keyword": "<keyword>", "found": true, "importance": "high|medium|low"},
    ...
  ],
  "missingKeywords": ["<missing keyword 1>", ...],
  "suggestions": ["<actionable suggestion 1>", "<actionable suggestion 2>", ...],
  "sectionScores": {
    "skills": <number 0-100>,
    "experience": <number 0-100>,
    "education": <number 0-100>,
    "keywords": <number 0-100>
  }
}

Extract at least 10-15 relevant keywords from the job description and assess each one against the resume. Include both found and missing keywords.`;

  const userPrompt = `RESUME:
${resumeText}

JOB DESCRIPTION:
${jobDescription}

Provide a comprehensive analysis as JSON only, no markdown or extra text.`;

  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    max_completion_tokens: 8192,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    res.status(500).json({ error: "No response from AI" });
    return;
  }

  let aiResult: {
    overallScore: number;
    summary: string;
    strengths: string[];
    gaps: string[];
    matchedKeywords: Array<{ keyword: string; found: boolean; importance: "high" | "medium" | "low" }>;
    missingKeywords: string[];
    suggestions: string[];
    sectionScores: { skills: number; experience: number; education: number; keywords: number };
  };

  try {
    aiResult = JSON.parse(content);
  } catch {
    res.status(500).json({ error: "Failed to parse AI response" });
    return;
  }

  const [analysis] = await db.insert(analysesTable).values({
    jobTitle: jobTitle ?? null,
    companyName: companyName ?? null,
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

  res.json(analysis);
});

router.get("/resume/analyses", async (req, res): Promise<void> => {
  const analyses = await db
    .select({
      id: analysesTable.id,
      jobTitle: analysesTable.jobTitle,
      companyName: analysesTable.companyName,
      overallScore: analysesTable.overallScore,
      summary: analysesTable.summary,
      createdAt: analysesTable.createdAt,
    })
    .from(analysesTable)
    .orderBy(desc(analysesTable.createdAt));

  res.json(analyses);
});

router.get("/resume/analyses/:id", async (req, res): Promise<void> => {
  const params = GetAnalysisParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [analysis] = await db
    .select()
    .from(analysesTable)
    .where(eq(analysesTable.id, params.data.id));

  if (!analysis) {
    res.status(404).json({ error: "Analysis not found" });
    return;
  }

  res.json(analysis);
});

router.delete("/resume/analyses/:id", async (req, res): Promise<void> => {
  const params = DeleteAnalysisParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(analysesTable)
    .where(eq(analysesTable.id, params.data.id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Analysis not found" });
    return;
  }

  res.sendStatus(204);
});

router.get("/resume/stats", async (_req, res): Promise<void> => {
  const statsResult = await db
    .select({
      totalAnalyses: count(analysesTable.id),
      averageScore: avg(analysesTable.overallScore),
      highestScore: max(analysesTable.overallScore),
      lowestScore: min(analysesTable.overallScore),
    })
    .from(analysesTable);

  const recentAnalyses = await db
    .select({
      id: analysesTable.id,
      jobTitle: analysesTable.jobTitle,
      companyName: analysesTable.companyName,
      overallScore: analysesTable.overallScore,
      summary: analysesTable.summary,
      createdAt: analysesTable.createdAt,
    })
    .from(analysesTable)
    .orderBy(desc(analysesTable.createdAt))
    .limit(5);

  const stats = statsResult[0];
  res.json({
    totalAnalyses: Number(stats?.totalAnalyses ?? 0),
    averageScore: Number(stats?.averageScore ?? 0),
    highestScore: Number(stats?.highestScore ?? 0),
    lowestScore: Number(stats?.lowestScore ?? 0),
    recentAnalyses,
  });
});

export default router;
