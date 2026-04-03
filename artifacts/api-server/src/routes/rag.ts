import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, resumeProfilesTable, resumeChunksTable } from "@workspace/db";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { openai } from "@workspace/integrations-openai-ai-server";
import { tokenize, bm25, type BM25Doc } from "../lib/bm25.js";
import { chunkResume } from "../lib/chunker.js";

const router: IRouter = Router();

const SYSTEM_PROMPT = `You are MatchPoint AI, an expert recruiting assistant.
You answer HR and recruiting questions by reasoning over candidate resume excerpts provided in the context.
Rules:
- Base your answer ONLY on the provided resume excerpts. Do NOT invent facts.
- Be specific: name the candidates, quote skills or titles where relevant.
- If the excerpts don't contain enough information, say so clearly.
- Keep responses concise and structured (use bullet points for lists of candidates).
- Never reveal raw chunk IDs. Refer to candidates by name or "Candidate #[id]" if no name is given.`;

router.post("/enterprise/rag/ingest/:resumeId", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const resumeId = parseInt(req.params.resumeId);
    const [profile] = await db.select().from(resumeProfilesTable)
      .where(and(eq(resumeProfilesTable.id, resumeId), eq(resumeProfilesTable.tenantId, req.user!.tenantId)));
    if (!profile) { res.status(404).json({ error: "Resume not found" }); return; }

    await db.delete(resumeChunksTable)
      .where(and(eq(resumeChunksTable.resumeProfileId, resumeId), eq(resumeChunksTable.tenantId, req.user!.tenantId)));

    const chunks = chunkResume(profile.extractedText);
    if (chunks.length === 0) { res.json({ inserted: 0, message: "No chunks extracted" }); return; }

    await db.insert(resumeChunksTable).values(
      chunks.map(c => ({ resumeProfileId: resumeId, tenantId: req.user!.tenantId, section: c.section, chunkText: c.chunkText }))
    );

    res.json({ inserted: chunks.length, sections: [...new Set(chunks.map(c => c.section))] });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Server error" });
  }
});

router.post("/enterprise/rag/ingest-all", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const profiles = await db.select({ id: resumeProfilesTable.id, extractedText: resumeProfilesTable.extractedText })
      .from(resumeProfilesTable)
      .where(eq(resumeProfilesTable.tenantId, req.user!.tenantId));

    await db.delete(resumeChunksTable).where(eq(resumeChunksTable.tenantId, req.user!.tenantId));

    let totalInserted = 0;
    for (const profile of profiles) {
      const chunks = chunkResume(profile.extractedText);
      if (chunks.length) {
        await db.insert(resumeChunksTable).values(
          chunks.map(c => ({ resumeProfileId: profile.id, tenantId: req.user!.tenantId, section: c.section, chunkText: c.chunkText }))
        );
        totalInserted += chunks.length;
      }
    }

    res.json({ resumes: profiles.length, chunks: totalInserted });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Server error" });
  }
});

router.get("/enterprise/rag/stats", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const chunks = await db.select({ resumeProfileId: resumeChunksTable.resumeProfileId })
      .from(resumeChunksTable)
      .where(eq(resumeChunksTable.tenantId, req.user!.tenantId));

    const uniqueResumes = new Set(chunks.map(c => c.resumeProfileId)).size;
    res.json({ totalChunks: chunks.length, indexedResumes: uniqueResumes });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Server error" });
  }
});

router.post("/enterprise/rag/query", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const { question, topK = 8 } = req.body as { question: string; topK?: number };

    if (!question || typeof question !== "string" || question.trim().length < 5) {
      res.status(400).json({ error: "A question of at least 5 characters is required" });
      return;
    }

    const allChunks = await db.select({
      id: resumeChunksTable.id,
      resumeProfileId: resumeChunksTable.resumeProfileId,
      section: resumeChunksTable.section,
      chunkText: resumeChunksTable.chunkText,
    }).from(resumeChunksTable)
      .where(eq(resumeChunksTable.tenantId, req.user!.tenantId));

    if (allChunks.length === 0) {
      res.json({ answer: "No resumes have been indexed yet. Please upload resumes and index them first.", sources: [], question });
      return;
    }

    const queryTokens = tokenize(question);
    const docs: BM25Doc[] = allChunks.map(c => ({ id: c.id, tokens: tokenize(c.chunkText) }));

    const scored = bm25(queryTokens, docs).slice(0, Math.min(topK, 20));

    if (scored.length === 0) {
      res.json({ answer: "I could not find any relevant information in the indexed resumes for your question. Try different keywords.", sources: [], question });
      return;
    }

    const profileIds = [...new Set(allChunks.filter(c => scored.some(s => s.id === c.id)).map(c => c.resumeProfileId))];
    const profiles = await db.select({ id: resumeProfilesTable.id, candidateName: resumeProfilesTable.candidateName, candidateEmail: resumeProfilesTable.candidateEmail })
      .from(resumeProfilesTable)
      .where(eq(resumeProfilesTable.tenantId, req.user!.tenantId));
    const profileMap = new Map(profiles.map(p => [p.id, p]));

    const topChunks = scored.map(s => {
      const chunk = allChunks.find(c => c.id === s.id)!;
      const profile = profileMap.get(chunk.resumeProfileId);
      return { chunkId: s.id, resumeProfileId: chunk.resumeProfileId, candidateName: profile?.candidateName || `Candidate #${chunk.resumeProfileId}`, candidateEmail: profile?.candidateEmail || null, section: chunk.section, chunkText: chunk.chunkText, bm25Score: Math.round(s.score * 100) / 100 };
    });

    const contextBlocks = topChunks.map((c, i) =>
      `[Source ${i + 1}: ${c.candidateName} – ${c.section}]\n${c.chunkText}`
    ).join("\n\n---\n\n");

    const userPrompt = `Resume excerpts:\n\n${contextBlocks}\n\n---\n\nQuestion: ${question}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-5.2",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      max_completion_tokens: 800,
      temperature: 0.2,
    });

    const answer = completion.choices[0]?.message?.content?.trim() ?? "No response generated.";

    const sources = topChunks.map(c => ({
      resumeProfileId: c.resumeProfileId,
      candidateName: c.candidateName,
      candidateEmail: c.candidateEmail,
      section: c.section,
      snippet: c.chunkText.slice(0, 220).replace(/\s+/g, " ").trim() + (c.chunkText.length > 220 ? "…" : ""),
      bm25Score: c.bm25Score,
    }));

    res.json({ answer, sources, question, chunksSearched: allChunks.length, chunksUsed: topChunks.length });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Server error" });
  }
});

export default router;
