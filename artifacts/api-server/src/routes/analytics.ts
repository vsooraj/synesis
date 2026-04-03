import { Router, type IRouter } from "express";
import { eq, and, inArray } from "drizzle-orm";
import { db, bulkJobsTable, bulkJobResultsTable, analysesTable } from "@workspace/db";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";

const router: IRouter = Router();

router.get("/enterprise/analytics/skills-gap", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId;

    const bulkJobs = await db.select({ id: bulkJobsTable.id })
      .from(bulkJobsTable)
      .where(eq(bulkJobsTable.tenantId, tenantId));

    const bulkJobIds = bulkJobs.map(j => j.id);

    if (bulkJobIds.length === 0) {
      res.json({ gaps: [], strengths: [], totalAnalyses: 0 });
      return;
    }

    const results = await db.select({
      analysisId: bulkJobResultsTable.analysisId,
    }).from(bulkJobResultsTable)
      .where(and(
        inArray(bulkJobResultsTable.bulkJobId, bulkJobIds),
        eq(bulkJobResultsTable.status, "Complete")
      ));

    const analysisIds = results.map(r => r.analysisId).filter((id): id is number => id !== null);

    if (analysisIds.length === 0) {
      res.json({ gaps: [], strengths: [], totalAnalyses: 0 });
      return;
    }

    const analyses = await db.select({
      gaps: analysesTable.gaps,
      strengths: analysesTable.strengths,
      overallScore: analysesTable.overallScore,
      sectionScores: analysesTable.sectionScores,
    }).from(analysesTable)
      .where(inArray(analysesTable.id, analysisIds));

    const gapFreq: Record<string, number> = {};
    const strengthFreq: Record<string, number> = {};
    let totalSkills = 0, totalExp = 0, totalEdu = 0, totalKeywords = 0;

    for (const a of analyses) {
      for (const gap of (a.gaps as string[])) {
        const key = gap.trim().toLowerCase();
        gapFreq[key] = (gapFreq[key] || 0) + 1;
      }
      for (const strength of (a.strengths as string[])) {
        const key = strength.trim().toLowerCase();
        strengthFreq[key] = (strengthFreq[key] || 0) + 1;
      }
      const ss = a.sectionScores as { skills: number; experience: number; education: number; keywords: number };
      totalSkills += ss?.skills || 0;
      totalExp += ss?.experience || 0;
      totalEdu += ss?.education || 0;
      totalKeywords += ss?.keywords || 0;
    }

    const n = analyses.length;
    const gaps = Object.entries(gapFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([label, count]) => ({ label, count, pct: Math.round((count / n) * 100) }));

    const strengths = Object.entries(strengthFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([label, count]) => ({ label, count, pct: Math.round((count / n) * 100) }));

    const avgSectionScores = n > 0 ? {
      skills: Math.round(totalSkills / n),
      experience: Math.round(totalExp / n),
      education: Math.round(totalEdu / n),
      keywords: Math.round(totalKeywords / n),
    } : null;

    res.json({ gaps, strengths, totalAnalyses: n, avgSectionScores });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Server error" });
  }
});

router.get("/enterprise/analytics/score-distribution", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const tenantId = req.user!.tenantId;

    const bulkJobs = await db.select({ id: bulkJobsTable.id })
      .from(bulkJobsTable)
      .where(eq(bulkJobsTable.tenantId, tenantId));

    const bulkJobIds = bulkJobs.map(j => j.id);
    if (bulkJobIds.length === 0) { res.json({ buckets: [], totalAnalyses: 0 }); return; }

    const results = await db.select({ analysisId: bulkJobResultsTable.analysisId })
      .from(bulkJobResultsTable)
      .where(and(inArray(bulkJobResultsTable.bulkJobId, bulkJobIds), eq(bulkJobResultsTable.status, "Complete")));

    const analysisIds = results.map(r => r.analysisId).filter((id): id is number => id !== null);
    if (analysisIds.length === 0) { res.json({ buckets: [], totalAnalyses: 0 }); return; }

    const analyses = await db.select({ overallScore: analysesTable.overallScore })
      .from(analysesTable)
      .where(inArray(analysesTable.id, analysisIds));

    const buckets = [
      { range: "0-20", min: 0, max: 20, count: 0 },
      { range: "21-40", min: 21, max: 40, count: 0 },
      { range: "41-60", min: 41, max: 60, count: 0 },
      { range: "61-80", min: 61, max: 80, count: 0 },
      { range: "81-100", min: 81, max: 100, count: 0 },
    ];

    for (const a of analyses) {
      const score = a.overallScore;
      const bucket = buckets.find(b => score >= b.min && score <= b.max);
      if (bucket) bucket.count++;
    }

    res.json({ buckets, totalAnalyses: analyses.length });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Server error" });
  }
});

export default router;
