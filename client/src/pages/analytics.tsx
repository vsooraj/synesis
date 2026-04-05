import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../context/auth";
import { enterpriseApi, type DepartmentBreakdown } from "../lib/enterprise-api";
import { Layout } from "../components/layout";

interface GapEntry { label: string; count: number; pct: number }
interface Bucket { range: string; count: number }
interface AnalyticsData {
  gaps: GapEntry[];
  strengths: GapEntry[];
  totalAnalyses: number;
  avgSectionScores: { skills: number; experience: number; education: number; keywords: number } | null;
}
interface DistData { buckets: Bucket[]; totalAnalyses: number }

const SECTION_COLORS: Record<string, string> = {
  skills: "bg-blue-500",
  experience: "bg-purple-500",
  education: "bg-amber-500",
  keywords: "bg-green-500",
};

const SECTION_LABELS: Record<string, string> = {
  skills: "Skills",
  experience: "Experience",
  education: "Education",
  keywords: "Keywords",
};

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [dist, setDist] = useState<DistData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"gaps" | "strengths" | "scores">("gaps");

  const { data: deptBreakdown = [] } = useQuery<DepartmentBreakdown[]>({
    queryKey: ["dept-breakdown"],
    queryFn: () => enterpriseApi.departments.breakdown(),
    enabled: !!user,
  });

  useEffect(() => {
    if (!user) return;
    Promise.all([
      enterpriseApi.analytics.skillsGap(),
      enterpriseApi.analytics.scoreDistribution(),
    ]).then(([a, d]) => {
      setAnalytics(a);
      setDist(d);
    }).catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [user]);

  if (!user) return <div className="p-8 text-center text-gray-500">Please log in to view analytics.</div>;

  if (loading) return (
    <div className="w-full px-4 py-16 text-center text-gray-400">
      <div className="text-3xl mb-2">⏳</div>Loading analytics…
    </div>
  );

  if (error) return (
    <div className="w-full px-4 py-8">
      <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3">{error}</div>
    </div>
  );

  const maxCount = analytics?.gaps[0]?.count ?? 1;
  const maxStr = analytics?.strengths[0]?.count ?? 1;
  const maxBucket = Math.max(...(dist?.buckets.map(b => b.count) ?? [1]));

  return (
    <Layout>
    <div className="w-full px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Skills Gap Analytics</h1>
        <p className="text-gray-500 mt-1">Aggregate intelligence from all candidate analyses in your tenant.</p>
      </div>

      {analytics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total Analyses" value={analytics.totalAnalyses} color="blue" />
          <StatCard label="Unique Gaps Found" value={analytics.gaps.length} color="red" />
          <StatCard label="Common Strengths" value={analytics.strengths.length} color="green" />
          {analytics.avgSectionScores && (
            <StatCard label="Avg. Skills Score" value={`${analytics.avgSectionScores.skills}/100`} color="purple" />
          )}
        </div>
      )}

      {analytics?.totalAnalyses === 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-12 text-center text-gray-500">
          <div className="text-4xl mb-3">📊</div>
          <p className="font-semibold text-gray-700">No analyses yet</p>
          <p className="text-sm mt-1">Run some bulk analysis jobs to populate the analytics dashboard.</p>
        </div>
      )}

      {analytics && analytics.totalAnalyses > 0 && (
        <>
          <div className="flex gap-2 mb-6 border-b border-gray-200 flex-wrap">
            {([["gaps", "Skills Gaps"], ["strengths", "Common Strengths"], ["scores", "Score Distribution"]] as const).map(([t, label]) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "gaps" && (
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <h2 className="font-semibold text-gray-800 mb-1">Most Common Skills Gaps</h2>
              <p className="text-xs text-gray-500 mb-6">Percentage of candidates where this gap appeared</p>
              <div className="space-y-3">
                {analytics.gaps.slice(0, 15).map((g, i) => (
                  <div key={g.label} className="flex items-center gap-3">
                    <span className="w-5 text-xs text-gray-400 text-right">{i + 1}</span>
                    <span className="w-52 text-sm text-gray-700 truncate capitalize">{g.label}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                      <div
                        className="h-full bg-red-400 rounded-full transition-all"
                        style={{ width: `${(g.count / maxCount) * 100}%` }}
                      />
                    </div>
                    <span className="w-16 text-sm text-gray-600 text-right">{g.pct}% <span className="text-xs text-gray-400">({g.count})</span></span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "strengths" && (
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <h2 className="font-semibold text-gray-800 mb-1">Most Common Strengths</h2>
              <p className="text-xs text-gray-500 mb-6">Skills that candidates excel at</p>
              <div className="space-y-3">
                {analytics.strengths.slice(0, 15).map((s, i) => (
                  <div key={s.label} className="flex items-center gap-3">
                    <span className="w-5 text-xs text-gray-400 text-right">{i + 1}</span>
                    <span className="w-52 text-sm text-gray-700 truncate capitalize">{s.label}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                      <div
                        className="h-full bg-green-400 rounded-full transition-all"
                        style={{ width: `${(s.count / maxStr) * 100}%` }}
                      />
                    </div>
                    <span className="w-16 text-sm text-gray-600 text-right">{s.pct}% <span className="text-xs text-gray-400">({s.count})</span></span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "scores" && (
            <div className="space-y-6">
              {dist && dist.totalAnalyses > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                  <h2 className="font-semibold text-gray-800 mb-1">Score Distribution</h2>
                  <p className="text-xs text-gray-500 mb-6">How candidates are distributed across score ranges</p>
                  <div className="space-y-3">
                    {dist.buckets.map(b => (
                      <div key={b.range} className="flex items-center gap-3">
                        <span className="w-16 text-sm text-gray-700 font-mono">{b.range}</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full flex items-center justify-end pr-2 transition-all"
                            style={{ width: maxBucket > 0 ? `${(b.count / maxBucket) * 100}%` : "0%" }}
                          >
                            {b.count > 0 && <span className="text-xs text-white font-medium">{b.count}</span>}
                          </div>
                        </div>
                        <span className="w-8 text-sm text-gray-500 text-right">{b.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {analytics.avgSectionScores && (
                <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                  <h2 className="font-semibold text-gray-800 mb-6">Average Section Scores</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(analytics.avgSectionScores).map(([key, val]) => (
                      <div key={key} className="text-center">
                        <div className="relative w-20 h-20 mx-auto mb-2">
                          <svg className="w-20 h-20 -rotate-90" viewBox="0 0 36 36">
                            <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f3f4f6" strokeWidth="3" />
                            <circle
                              cx="18" cy="18" r="15.9" fill="none"
                              stroke={key === "skills" ? "#3b82f6" : key === "experience" ? "#a855f7" : key === "education" ? "#f59e0b" : "#22c55e"}
                              strokeWidth="3"
                              strokeDasharray={`${val} ${100 - val}`}
                              strokeLinecap="round"
                            />
                          </svg>
                          <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-gray-700">{val}</span>
                        </div>
                        <p className="text-xs text-gray-600 font-medium">{SECTION_LABELS[key]}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {deptBreakdown.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Department Breakdown</h2>
          <div className="space-y-4">
            {deptBreakdown.map(dept => {
              const maxPositions = Math.max(...deptBreakdown.map(d => d.totalPositions), 1);
              const fillPct = dept.headCount > 0 ? Math.min(100, Math.round((dept.openPositions / dept.headCount) * 100)) : null;
              return (
                <div key={dept.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <p className="font-semibold text-gray-800">{dept.name}</p>
                      <p className="text-xs text-gray-400">{dept.headCount} approved headcount · {dept.jobDescriptions} JDs</p>
                    </div>
                    <div className="flex gap-4 text-center text-sm">
                      <div><p className="font-bold text-blue-600">{dept.openPositions}</p><p className="text-xs text-gray-400">Open</p></div>
                      <div><p className="font-bold text-green-600">{dept.filledPositions}</p><p className="text-xs text-gray-400">Filled</p></div>
                      <div><p className="font-bold text-gray-700">{dept.totalPositions}</p><p className="text-xs text-gray-400">Total</p></div>
                    </div>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(dept.totalPositions / maxPositions) * 100}%` }} />
                  </div>
                  {Object.keys(dept.statusBreakdown).length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(dept.statusBreakdown).map(([status, count]) => (
                        <span key={status} className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">{status}: {count}</span>
                      ))}
                    </div>
                  )}
                  {fillPct !== null && (
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${fillPct > 80 ? "bg-red-400" : fillPct > 50 ? "bg-amber-400" : "bg-green-400"}`} style={{ width: `${fillPct}%` }} />
                      </div>
                      <span>{fillPct}% of headcount in active hiring</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
    </Layout>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    red: "bg-red-50 border-red-200 text-red-700",
    green: "bg-green-50 border-green-200 text-green-700",
    purple: "bg-purple-50 border-purple-200 text-purple-700",
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs font-medium mt-1 opacity-75">{label}</div>
    </div>
  );
}
