const STOP_WORDS = new Set(["a","an","the","and","or","but","in","on","at","to","for","of","with","by","from","is","are","was","were","be","been","being","have","has","had","do","does","did","will","would","should","could","may","might","i","you","he","she","we","they","it","my","your","his","her","our","their","this","that","these","those","as","not","no","so","if","than","then","also","after","before","when","where","who","which","what","how"]);

export function tokenize(text: string): string[] {
  return text.toLowerCase()
    .replace(/[^a-z0-9\s#+]/g, " ")
    .split(/\s+/)
    .filter(t => t.length > 1 && !STOP_WORDS.has(t));
}

export interface BM25Doc { id: number; tokens: string[] }

export interface BM25Result { id: number; score: number }

export function bm25(queryTokens: string[], docs: BM25Doc[], k1 = 1.5, b = 0.75): BM25Result[] {
  const N = docs.length;
  if (N === 0) return [];

  const avgDocLen = docs.reduce((s, d) => s + d.tokens.length, 0) / N;

  const df = new Map<string, number>();
  for (const doc of docs) {
    for (const term of new Set(doc.tokens)) {
      df.set(term, (df.get(term) || 0) + 1);
    }
  }

  const idf = (term: string) => {
    const n = df.get(term) || 0;
    return Math.log((N - n + 0.5) / (n + 0.5) + 1);
  };

  const results: BM25Result[] = [];

  for (const doc of docs) {
    const docLen = doc.tokens.length;
    const tf = new Map<string, number>();
    for (const t of doc.tokens) tf.set(t, (tf.get(t) || 0) + 1);

    let score = 0;
    for (const qt of new Set(queryTokens)) {
      const f = tf.get(qt) || 0;
      if (f === 0) continue;
      const termScore = idf(qt) * (f * (k1 + 1)) / (f + k1 * (1 - b + b * (docLen / avgDocLen)));
      score += termScore;
    }

    if (score > 0) results.push({ id: doc.id, score });
  }

  return results.sort((a, b) => b.score - a.score);
}
