import { useEffect, useState, useRef } from "react";
import { useAuth } from "../context/auth";
import { enterpriseApi } from "../lib/enterprise-api";
import type { JobDescription, ShortlistJob, ShortlistResult } from "../lib/enterprise-api";
import { Layout } from "../components/layout";

const STATUS_STYLE: Record<string, { dot: string; badge: string; label: string }> = {
  Pending: { dot: "bg-gray-400", badge: "bg-gray-100 text-gray-600", label: "Pending" },
  Running: { dot: "bg-blue-500 animate-pulse", badge: "bg-blue-100 text-blue-700", label: "Running" },
  "Pending Approval": { dot: "bg-amber-500 animate-pulse", badge: "bg-amber-100 text-amber-700", label: "Pending Approval" },
  Approved: { dot: "bg-green-500", badge: "bg-green-100 text-green-700", label: "Approved" },
  Rejected: { dot: "bg-red-500", badge: "bg-red-100 text-red-700", label: "Rejected" },
  Failed: { dot: "bg-red-500", badge: "bg-red-100 text-red-700", label: "Failed" },
};

export default function AgentPage() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<ShortlistJob[]>([]);
  const [jdList, setJdList] = useState<JobDescription[]>([]);
  const [selectedJob, setSelectedJob] = useState<{ job: ShortlistJob; results: ShortlistResult[] } | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [approvalNote, setApprovalNote] = useState("");
  const [showApproval, setShowApproval] = useState(false);
  const [activeTab, setActiveTab] = useState<"list" | "report" | "log">("list");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [form, setForm] = useState({ jobDescriptionId: "", scoreThreshold: 70, maxCandidates: 50 });

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3500); };

  const loadJobs = async () => {
    try {
      const data = await enterpriseApi.agent.list();
      setJobs(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch { /* silent */ }
  };

  const loadDetail = async (id: number) => {
    try {
      const data = await enterpriseApi.agent.get(id);
      setSelectedJob(data);
    } catch { /* silent */ }
  };

  useEffect(() => {
    if (!user) return;
    Promise.all([
      enterpriseApi.agent.list(),
      enterpriseApi.jobs.list(),
    ]).then(([j, jds]) => {
      setJobs(j.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      setJdList(jds.filter(jd => jd.status === "Active"));
    }).catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    const hasActive = jobs.some(j => j.status === "Running" || j.status === "Pending");
    if (hasActive && !pollRef.current) {
      pollRef.current = setInterval(loadJobs, 3000);
    } else if (!hasActive && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [jobs]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.jobDescriptionId) { showToast("Please select a job description"); return; }
    try {
      const job = await enterpriseApi.agent.create({
        jobDescriptionId: parseInt(form.jobDescriptionId),
        scoreThreshold: form.scoreThreshold,
        maxCandidates: form.maxCandidates,
      });
      setJobs(prev => [job, ...prev]);
      setShowCreate(false);
      setForm({ jobDescriptionId: "", scoreThreshold: 70, maxCandidates: 50 });
      showToast("Shortlisting agent started!");
      setTimeout(() => loadDetail(job.id), 1000);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to start agent");
    }
  };

  const handleApprove = async () => {
    if (!selectedJob) return;
    try {
      await enterpriseApi.agent.approve(selectedJob.job.id, approvalNote);
      showToast("Shortlist approved!");
      setShowApproval(false);
      setApprovalNote("");
      await loadDetail(selectedJob.job.id);
      await loadJobs();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to approve");
    }
  };

  const handleReject = async () => {
    if (!selectedJob) return;
    try {
      await enterpriseApi.agent.reject(selectedJob.job.id, approvalNote);
      showToast("Shortlist rejected.");
      setShowApproval(false);
      setApprovalNote("");
      await loadDetail(selectedJob.job.id);
      await loadJobs();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to reject");
    }
  };

  const openDetail = async (job: ShortlistJob) => {
    setSelectedJob({ job, results: [] });
    setActiveTab("list");
    await loadDetail(job.id);
  };

  if (!user) return <div className="p-8 text-center text-gray-500">Please log in to use the AI agent.</div>;

  return (
    <Layout>
    <div className="w-full px-4 py-8 relative">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white px-4 py-3 rounded-xl text-sm shadow-xl animate-fade-in max-w-sm">{toast}</div>
      )}

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Shortlisting Agent</h1>
          <p className="text-gray-500 mt-1">Automated candidate shortlisting with human-in-the-loop approval.</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          + New Shortlist
        </button>
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Start Shortlisting Agent</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Job Description *</label>
                <select
                  value={form.jobDescriptionId}
                  onChange={e => setForm(f => ({ ...f, jobDescriptionId: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select active JD…</option>
                  {jdList.map(jd => (
                    <option key={jd.id} value={jd.id}>{jd.title}{jd.company ? ` @ ${jd.company}` : ""}</option>
                  ))}
                </select>
                {jdList.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">No active job descriptions. Set a JD to "Active" first.</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Score Threshold: <span className="text-blue-600 font-bold">{form.scoreThreshold}</span>
                </label>
                <input type="range" min={0} max={100} value={form.scoreThreshold}
                  onChange={e => setForm(f => ({ ...f, scoreThreshold: Number(e.target.value) }))}
                  className="w-full" />
                <p className="text-xs text-gray-500 mt-0.5">Candidates scoring below this are excluded from the shortlist.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max candidates to analyse: <span className="text-blue-600 font-bold">{form.maxCandidates}</span>
                </label>
                <input type="range" min={5} max={100} step={5} value={form.maxCandidates}
                  onChange={e => setForm(f => ({ ...f, maxCandidates: Number(e.target.value) }))}
                  className="w-full" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
                  Start Agent
                </button>
                <button type="button" onClick={() => setShowCreate(false)} className="flex-1 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Shortlist Jobs</h2>
          {loading ? (
            <div className="text-gray-400 text-sm py-4">Loading…</div>
          ) : jobs.length === 0 ? (
            <div className="bg-gray-50 rounded-xl p-6 text-center text-gray-400 text-sm">
              No shortlisting jobs yet. Click "+ New Shortlist" to start.
            </div>
          ) : (
            <div className="space-y-2">
              {jobs.map(job => {
                const s = STATUS_STYLE[job.status] || STATUS_STYLE.Pending;
                const jd = jdList.find(j => j.id === job.jobDescriptionId);
                return (
                  <button
                    key={job.id}
                    onClick={() => openDetail(job)}
                    className={`w-full text-left bg-white border rounded-xl p-4 hover:shadow-md transition-all ${selectedJob?.job.id === job.id ? "border-blue-500 shadow-md" : "border-gray-200"}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.dot}`} />
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${s.badge}`}>{s.label}</span>
                      {job.status === "Pending Approval" && (
                        <span className="text-xs bg-amber-500 text-white px-1.5 py-0.5 rounded font-bold">ACTION</span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {jd?.title || `JD #${job.jobDescriptionId}`}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {job.totalShortlisted}/{job.totalSearched} shortlisted · threshold {job.scoreThreshold}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="md:col-span-2">
          {!selectedJob ? (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-12 text-center h-full flex flex-col items-center justify-center">
              <div className="text-5xl mb-4">🤖</div>
              <h3 className="font-semibold text-gray-800 mb-2">Select a shortlisting job</h3>
              <p className="text-sm text-gray-500 max-w-xs">The agent searches your talent pool, analyses each candidate, and generates a ranked shortlist for your approval.</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <div className="p-5 border-b border-gray-100">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${STATUS_STYLE[selectedJob.job.status]?.dot}`} />
                      <h3 className="font-semibold text-gray-900">
                        {jdList.find(j => j.id === selectedJob.job.jobDescriptionId)?.title || `JD #${selectedJob.job.jobDescriptionId}`}
                      </h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[selectedJob.job.status]?.badge}`}>
                        {STATUS_STYLE[selectedJob.job.status]?.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {selectedJob.job.totalShortlisted} shortlisted from {selectedJob.job.totalSearched} analysed · threshold {selectedJob.job.scoreThreshold}/100
                    </p>
                  </div>
                  {selectedJob.job.status === "Pending Approval" && (
                    <button
                      onClick={() => setShowApproval(true)}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      Review & Approve
                    </button>
                  )}
                </div>
              </div>

              <div className="flex border-b border-gray-100">
                {(["list", "report", "log"] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setActiveTab(t)}
                    className={`flex-1 py-2.5 text-sm font-medium transition-colors ${activeTab === t ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500 hover:text-gray-700"}`}
                  >
                    {t === "list" ? "Candidates" : t === "report" ? "Report" : "Agent Log"}
                  </button>
                ))}
              </div>

              <div className="p-5 max-h-[500px] overflow-y-auto">
                {activeTab === "list" && (
                  selectedJob.results.length === 0 ? (
                    <div className="text-center text-gray-400 py-8">
                      {selectedJob.job.status === "Running" || selectedJob.job.status === "Pending"
                        ? "⏳ Agent is analysing candidates…"
                        : "No results yet."}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedJob.results.map(r => {
                        const score = r.overallScore ?? 0;
                        const included = r.included === "yes";
                        return (
                          <div key={r.id} className={`rounded-xl border p-4 ${included ? "border-gray-200" : "border-gray-100 opacity-60"}`}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm text-gray-900">
                                    {r.candidate?.candidateName || `Candidate #${r.resumeProfileId}`}
                                  </span>
                                  {included ? (
                                    <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">Shortlisted</span>
                                  ) : (
                                    <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">Below threshold</span>
                                  )}
                                </div>
                                {r.candidate?.candidateEmail && (
                                  <p className="text-xs text-gray-500 mt-0.5">{r.candidate.candidateEmail}</p>
                                )}
                                {r.summary && <p className="text-xs text-gray-600 mt-1.5 line-clamp-2">{r.summary}</p>}
                                {r.strengths && r.strengths.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {(r.strengths as string[]).slice(0, 3).map(s => (
                                      <span key={s} className="text-xs bg-green-50 text-green-700 px-1.5 py-0.5 rounded">{s}</span>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="flex-shrink-0 text-center">
                                <div className={`text-lg font-bold ${score >= 80 ? "text-green-600" : score >= 60 ? "text-amber-600" : "text-red-500"}`}>
                                  {score}
                                </div>
                                <div className="text-xs text-gray-400">/100</div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )
                )}

                {activeTab === "report" && (
                  selectedJob.job.reportMarkdown ? (
                    <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans leading-relaxed">{selectedJob.job.reportMarkdown}</pre>
                  ) : (
                    <div className="text-center text-gray-400 py-8">Report not yet generated.</div>
                  )
                )}

                {activeTab === "log" && (
                  <div className="space-y-1">
                    {((selectedJob.job as ShortlistJob & { agentLog?: string[] }).agentLog ?? []).map((entry, i) => (
                      <div key={i} className="text-xs font-mono text-gray-600 py-0.5 border-b border-gray-50 last:border-0">
                        {entry}
                      </div>
                    ))}
                    {!((selectedJob.job as ShortlistJob & { agentLog?: string[] }).agentLog?.length) && (
                      <div className="text-gray-400 text-sm text-center py-4">No log entries yet.</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {showApproval && selectedJob && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Review Shortlist</h2>
            <p className="text-sm text-gray-500 mb-4">
              {selectedJob.job.totalShortlisted} candidates shortlisted · {selectedJob.job.totalSearched} analysed
            </p>
            <textarea
              value={approvalNote}
              onChange={e => setApprovalNote(e.target.value)}
              placeholder="Optional note (visible in audit log)…"
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <div className="flex gap-2">
              <button onClick={handleApprove} className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors">
                Approve Shortlist
              </button>
              <button onClick={handleReject} className="flex-1 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors">
                Reject
              </button>
              <button onClick={() => setShowApproval(false)} className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </Layout>
  );
}
