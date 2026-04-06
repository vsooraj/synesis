import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, resumeProfilesTable } from "@workspace/db";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";

const router: IRouter = Router();

const STOP_WORDS = new Set(["a","an","the","and","or","but","in","on","at","to","for","of","with","by","from","is","are","was","were","be","been","being","have","has","had","do","does","did","will","would","should","could","may","might","i","you","he","she","we","they","it","my","your","his","her","our","their","this","that","these","those","as","not","no","so","if","than","then","also","after","before","when","where","who","which","what","how"]);

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

function tokenize(text: string): string[] {
  return text.toLowerCase()
    .replace(/[^a-z0-9\s+#]/g, " ")
    .split(/\s+/)
    .filter(t => t.length > 1 && !STOP_WORDS.has(t));
}

function termFreq(tokens: string[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const t of tokens) freq.set(t, (freq.get(t) || 0) + 1);
  return freq;
}

function tfidfScore(queryTokens: string[], docTokens: string[], idfMap: Map<string, number>): number {
  const docFreq = termFreq(docTokens);
  const docLen = docTokens.length || 1;
  let score = 0;
  for (const qt of new Set(queryTokens)) {
    const tf = (docFreq.get(qt) || 0) / docLen;
    const idf = idfMap.get(qt) ?? Math.log(10 + 1);
    score += tf * idf;
  }
  return score;
}

function buildIdf(queryTokens: string[], docs: string[][]): Map<string, number> {
  const idf = new Map<string, number>();
  const N = docs.length;
  for (const qt of new Set(queryTokens)) {
    const docCount = docs.filter(d => d.includes(qt)).length;
    idf.set(qt, Math.log((N + 1) / (docCount + 1)) + 1);
  }
  return idf;
}

function findBestSnippet(text: string, queryTokens: string[]): string {
  const lower = text.toLowerCase();
  let bestPos = 0;
  let bestHits = 0;
  const windowSize = 300;
  for (let i = 0; i < lower.length - windowSize; i += 50) {
    const window = lower.slice(i, i + windowSize);
    const hits = queryTokens.filter(t => window.includes(t)).length;
    if (hits > bestHits) { bestHits = hits; bestPos = i; }
  }
  return text.slice(bestPos, bestPos + windowSize).replace(/\s+/g, " ").trim();
}

router.post("/enterprise/search/talent", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const { query, limit = 10, candidateType } = req.body as { query: string; limit?: number; candidateType?: string };

    if (!query || typeof query !== "string" || query.trim().length < 3) {
      res.status(400).json({ error: "A search query of at least 3 characters is required" });
      return;
    }

    const profiles = await db.select({
      id: resumeProfilesTable.id,
      candidateType: resumeProfilesTable.candidateType,
      candidateName: resumeProfilesTable.candidateName,
      candidateEmail: resumeProfilesTable.candidateEmail,
      fileName: resumeProfilesTable.fileName,
      extractedText: resumeProfilesTable.extractedText,
      createdAt: resumeProfilesTable.createdAt,
    }).from(resumeProfilesTable)
      .where(eq(resumeProfilesTable.tenantId, req.user!.tenantId));

    const filtered = candidateType
      ? profiles.filter(p => p.candidateType === candidateType)
      : profiles;

    const queryTokens = tokenize(query);
    const docTokenArrays = filtered.map(p => tokenize(p.extractedText));
    const idfMap = buildIdf(queryTokens, docTokenArrays);

    const scored = filtered
      .map((p, i) => {
        const rawScore = tfidfScore(queryTokens, docTokenArrays[i], idfMap);
        const similarityScore = Math.min(100, Math.round(rawScore * 1000));
        const snippet = findBestSnippet(p.extractedText, queryTokens);
        return { id: p.id, candidateType: p.candidateType, candidateName: p.candidateName, candidateEmail: p.candidateEmail, fileName: p.fileName, createdAt: p.createdAt, similarityScore, snippet };
      })
      .filter(p => p.similarityScore > 0)
      .sort((a, b) => b.similarityScore - a.similarityScore)
      .slice(0, Math.min(limit, 50));

    res.json({ results: scored, query, embeddingUsed: false, searchMethod: "tfidf" });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Server error" });
  }
});

export { cosineSimilarity, tokenize, tfidfScore, buildIdf };
export default router;
