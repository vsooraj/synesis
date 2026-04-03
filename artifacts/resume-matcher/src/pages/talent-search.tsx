import { useState } from "react";
import { useAuth } from "../context/auth";
import { enterpriseApi } from "../lib/enterprise-api";

interface SearchResult {
  id: number;
  candidateName: string | null;
  candidateEmail: string | null;
  candidateType: string;
  fileName: string | null;
  similarityScore: number;
  snippet: string;
  createdAt: string;
}

const TYPE_COLORS: Record<string, string> = {
  Internal: "bg-blue-100 text-blue-800",
  External: "bg-gray-100 text-gray-700",
  Contractor: "bg-amber-100 text-amber-800",
};

export default function TalentSearchPage() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [candidateType, setCandidateType] = useState("");
  const [limit, setLimit] = useState(10);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [meta, setMeta] = useState<{ embeddingUsed: boolean; query: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  if (!user) return <div className="p-8 text-center text-gray-500">Please log in to use talent search.</div>;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError("");
    setSearched(false);
    try {
      const data = await enterpriseApi.search.talent({ query: query.trim(), limit, candidateType: candidateType || undefined });
      setResults(data.results);
      setMeta({ embeddingUsed: data.embeddingUsed, query: data.query });
      setSearched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  };

  const scoreColor = (s: number) => {
    if (s >= 80) return "text-green-700 bg-green-50";
    if (s >= 60) return "text-amber-700 bg-amber-50";
    return "text-red-700 bg-red-50";
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Talent Pool Search</h1>
        <p className="text-gray-500 mt-1">Search all candidates using natural language. AI-powered semantic matching.</p>
      </div>

      <form onSubmit={handleSearch} className="bg-white border border-gray-200 rounded-xl p-6 mb-6 shadow-sm">
        <div className="flex gap-3 mb-4">
          <input
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder='e.g. "Find engineers with Kubernetes and Python experience"'
            value={query}
            onChange={e => setQuery(e.target.value)}
            required
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Searching…" : "Search"}
          </button>
        </div>
        <div className="flex gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 whitespace-nowrap">Filter by type:</label>
            <select
              value={candidateType}
              onChange={e => setCandidateType(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All candidates</option>
              <option value="Internal">Internal employees</option>
              <option value="External">External candidates</option>
              <option value="Contractor">Contractors</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 whitespace-nowrap">Show top:</label>
            <select
              value={limit}
              onChange={e => setLimit(Number(e.target.value))}
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value={5}>5 results</option>
              <option value={10}>10 results</option>
              <option value={20}>20 results</option>
              <option value={50}>50 results</option>
            </select>
          </div>
        </div>
      </form>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-4 text-sm">{error}</div>
      )}

      {searched && meta && (
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-gray-600">
            <span className="font-medium">{results.length}</span> result{results.length !== 1 ? "s" : ""} for <span className="italic">"{meta.query}"</span>
          </p>
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${meta.embeddingUsed ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>
            {meta.embeddingUsed ? "Semantic AI search" : "Keyword search (no embeddings)"}
          </span>
        </div>
      )}

      {searched && results.length === 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-10 text-center text-gray-500">
          <div className="text-3xl mb-2">🔍</div>
          <p className="font-medium">No candidates found</p>
          <p className="text-sm mt-1">Try a different query or upload more resumes to the talent pool.</p>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-3">
          {results.map((r, i) => (
            <div key={r.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <span className="w-7 h-7 rounded-full bg-gray-100 text-gray-500 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 text-sm">
                        {r.candidateName || "Unnamed Candidate"}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[r.candidateType] || "bg-gray-100 text-gray-600"}`}>
                        {r.candidateType}
                      </span>
                    </div>
                    {r.candidateEmail && (
                      <p className="text-xs text-gray-500 mt-0.5">{r.candidateEmail}</p>
                    )}
                    {r.fileName && (
                      <p className="text-xs text-gray-400 mt-0.5">📄 {r.fileName}</p>
                    )}
                    <p className="text-sm text-gray-600 mt-2 line-clamp-2">{r.snippet}…</p>
                  </div>
                </div>
                {r.similarityScore > 0 && (
                  <div className={`flex-shrink-0 text-center rounded-lg px-3 py-1.5 ${scoreColor(r.similarityScore)}`}>
                    <div className="text-lg font-bold leading-none">{r.similarityScore}%</div>
                    <div className="text-xs mt-0.5 opacity-75">match</div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!searched && !loading && (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-10 text-center">
          <div className="text-4xl mb-3">🧠</div>
          <h3 className="font-semibold text-gray-800 mb-2">AI-Powered Semantic Search</h3>
          <p className="text-sm text-gray-600 max-w-sm mx-auto">
            Describe the skills, experience, or background you're looking for — in plain language. The AI will find the best-matching candidates in your talent pool.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 justify-center">
            {["React developer with 5+ years", "Data scientist with Python & ML", "Product manager with B2B SaaS"].map(ex => (
              <button key={ex} onClick={() => setQuery(ex)} className="text-xs px-3 py-1.5 bg-white border border-blue-200 text-blue-700 rounded-full hover:bg-blue-50 transition-colors">
                "{ex}"
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
