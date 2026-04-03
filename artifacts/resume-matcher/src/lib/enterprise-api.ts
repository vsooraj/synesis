const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

function getToken() {
  return localStorage.getItem("mp_token");
}

function authHeaders(extra: Record<string, string> = {}) {
  const t = getToken();
  return { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}), ...extra };
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: authHeaders(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data as T;
}

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: string;
  tenantId: number;
}

export interface ResumeProfile {
  id: number;
  tenantId: number;
  userId: number | null;
  candidateType: string;
  fileName: string | null;
  candidateName: string | null;
  candidateEmail: string | null;
  createdAt: string;
}

export interface JobDescription {
  id: number;
  title: string;
  company: string | null;
  status: string;
  createdBy: number | null;
  createdAt: string;
  descriptionText?: string;
}

export interface BulkJob {
  id: number;
  jobDescriptionId: number;
  status: string;
  total: number;
  processed: number;
  failed: number;
  createdAt: string;
  completedAt: string | null;
}

export interface BulkJobResult {
  id: number;
  resumeProfileId: number;
  analysisId: number | null;
  status: string;
  error: string | null;
  overallScore: number | null;
  summary: string | null;
  candidate?: { id: number; candidateName: string | null; candidateEmail: string | null; fileName: string | null };
}

export interface AuditEntry {
  id: number;
  userId: number | null;
  action: string;
  entityType: string;
  entityId: string | null;
  detail: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

export interface SearchResult {
  id: number;
  candidateName: string | null;
  candidateEmail: string | null;
  candidateType: string;
  fileName: string | null;
  similarityScore: number;
  snippet: string;
  createdAt: string;
}

export interface SkillsGapData {
  gaps: Array<{ label: string; count: number; pct: number }>;
  strengths: Array<{ label: string; count: number; pct: number }>;
  totalAnalyses: number;
  avgSectionScores: { skills: number; experience: number; education: number; keywords: number } | null;
}

export interface ScoreDistData {
  buckets: Array<{ range: string; count: number }>;
  totalAnalyses: number;
}

export interface ShortlistJob {
  id: number;
  tenantId: number;
  createdBy: number | null;
  jobDescriptionId: number;
  status: string;
  scoreThreshold: number;
  maxCandidates: number;
  totalSearched: number;
  totalShortlisted: number;
  reportMarkdown: string | null;
  agentLog: string[];
  approvedBy: number | null;
  approvalNote: string | null;
  createdAt: string;
  completedAt: string | null;
  approvedAt: string | null;
}

export interface ShortlistResult {
  id: number;
  resumeProfileId: number;
  similarityScore: number | null;
  overallScore: number | null;
  summary: string | null;
  strengths: string[] | null;
  gaps: string[] | null;
  included: string;
  candidate?: { id: number; candidateName: string | null; candidateEmail: string | null; fileName: string | null; candidateType: string } | null;
}

export interface WebhookConfig {
  id?: number;
  url: string;
  enabledEvents: string;
  enabled: boolean;
  description?: string | null;
  updatedAt?: string;
}

export interface WebhookDelivery {
  id: number;
  tenantId: number;
  event: string;
  payload: unknown;
  status: string;
  attempts: number;
  lastAttemptAt: string | null;
  deliveredAt: string | null;
  lastError: string | null;
  responseStatus: number | null;
  createdAt: string;
}

export const WEBHOOK_EVENT_LABELS: Record<string, string> = {
  "candidate.uploaded":         "Resume added to talent pool",
  "shortlist.pending_approval": "AI agent finished — awaiting HR review",
  "shortlist.approved":         "HR approved a shortlist",
  "shortlist.rejected":         "HR rejected a shortlist",
  "bulk_job.completed":         "Bulk analysis job finished",
  "position.opened":            "New position ticket created",
  "position.closed":            "Position filled or cancelled",
};

export const enterpriseApi = {
  auth: {
    register: (data: { email: string; name: string; password: string; tenantName: string }) =>
      req<{ token: string; user: AuthUser }>("POST", "/auth/register", data),
    login: (data: { email: string; password: string }) =>
      req<{ token: string; user: AuthUser }>("POST", "/auth/login", data),
    me: () => req<AuthUser>("GET", "/auth/me"),
    users: () => req<AuthUser[]>("GET", "/auth/users"),
    invite: (data: { email: string; name: string; password: string; role: string }) =>
      req<AuthUser>("POST", "/auth/users/invite", data),
    updateRole: (userId: number, role: string) =>
      req<AuthUser>("PUT", `/auth/users/${userId}/role`, { role }),
  },
  resumes: {
    list: () => req<ResumeProfile[]>("GET", "/enterprise/resumes"),
    get: (id: number) => req<ResumeProfile & { extractedText: string }>("GET", `/enterprise/resumes/${id}`),
    delete: (id: number) => req<void>("DELETE", `/enterprise/resumes/${id}`),
    uploadText: (data: { resumeText: string; candidateName?: string; candidateEmail?: string; candidateType?: string }) =>
      req<ResumeProfile>("POST", "/enterprise/resumes", data),
    uploadFile: async (file: File, meta: { candidateName?: string; candidateEmail?: string; candidateType?: string }) => {
      const form = new FormData();
      form.append("file", file);
      if (meta.candidateName) form.append("candidateName", meta.candidateName);
      if (meta.candidateEmail) form.append("candidateEmail", meta.candidateEmail);
      if (meta.candidateType) form.append("candidateType", meta.candidateType);
      const t = getToken();
      const res = await fetch(`${API}/enterprise/resumes`, {
        method: "POST",
        headers: t ? { Authorization: `Bearer ${t}` } : {},
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      return data as ResumeProfile;
    },
  },
  jobs: {
    list: () => req<JobDescription[]>("GET", "/enterprise/jobs"),
    get: (id: number) => req<JobDescription>("GET", `/enterprise/jobs/${id}`),
    create: (data: { title: string; company?: string; descriptionText: string; status?: string }) =>
      req<JobDescription>("POST", "/enterprise/jobs", data),
    update: (id: number, data: Partial<{ title: string; company: string; descriptionText: string; status: string }>) =>
      req<JobDescription>("PUT", `/enterprise/jobs/${id}`, data),
    delete: (id: number) => req<void>("DELETE", `/enterprise/jobs/${id}`),
  },
  bulkJobs: {
    list: () => req<BulkJob[]>("GET", "/enterprise/bulk-jobs"),
    get: (id: number) => req<{ job: BulkJob; results: BulkJobResult[] }>("GET", `/enterprise/bulk-jobs/${id}`),
    create: (data: { jobDescriptionId: number; resumeProfileIds: number[] }) =>
      req<BulkJob>("POST", "/enterprise/bulk-jobs", data),
    exportUrl: (id: number) => `${API}/enterprise/bulk-jobs/${id}/export`,
  },
  auditLog: {
    list: (limit?: number) => req<AuditEntry[]>("GET", `/enterprise/audit-log${limit ? `?limit=${limit}` : ""}`),
  },
  search: {
    talent: (data: { query: string; limit?: number; candidateType?: string }) =>
      req<{ results: SearchResult[]; query: string; embeddingUsed: boolean }>("POST", "/enterprise/search/talent", data),
  },
  analytics: {
    skillsGap: () => req<SkillsGapData>("GET", "/enterprise/analytics/skills-gap"),
    scoreDistribution: () => req<ScoreDistData>("GET", "/enterprise/analytics/score-distribution"),
  },
  agent: {
    list: () => req<ShortlistJob[]>("GET", "/enterprise/agent/shortlists"),
    get: (id: number) => req<{ job: ShortlistJob; results: ShortlistResult[] }>("GET", `/enterprise/agent/shortlists/${id}`),
    create: (data: { jobDescriptionId: number; scoreThreshold?: number; maxCandidates?: number }) =>
      req<ShortlistJob>("POST", "/enterprise/agent/shortlists", data),
    approve: (id: number, note?: string) =>
      req<ShortlistJob>("POST", `/enterprise/agent/shortlists/${id}/approve`, { note }),
    reject: (id: number, note?: string) =>
      req<ShortlistJob>("POST", `/enterprise/agent/shortlists/${id}/reject`, { note }),
  },
  tickets: {
    list: (params?: { status?: string; priority?: string }) => {
      const qs = new URLSearchParams();
      if (params?.status) qs.set("status", params.status);
      if (params?.priority) qs.set("priority", params.priority);
      return req<Ticket[]>("GET", `/enterprise/tickets?${qs}`);
    },
    create: (data: { title: string; priority?: string; department?: string; location?: string; openings?: number; description?: string; jobDescriptionId?: number; targetStartDate?: string }) =>
      req<Ticket>("POST", "/enterprise/tickets", data),
    get: (id: number) => req<TicketDetail>("GET", `/enterprise/tickets/${id}`),
    update: (id: number, data: Record<string, unknown>) => req<Ticket>("PATCH", `/enterprise/tickets/${id}`, data),
    setStatus: (id: number, status: string, closeReason?: string) => req<Ticket>("POST", `/enterprise/tickets/${id}/status`, { status, closeReason }),
    delete: (id: number) => req<void>("DELETE", `/enterprise/tickets/${id}`),
    addComment: (id: number, content: string) => req<TicketComment>("POST", `/enterprise/tickets/${id}/comments`, { content }),
    deleteComment: (id: number, commentId: number) => req<void>("DELETE", `/enterprise/tickets/${id}/comments/${commentId}`),
    addCandidate: (id: number, resumeProfileId: number, stage?: string) => req<TicketCandidate>("POST", `/enterprise/tickets/${id}/candidates`, { resumeProfileId, stage }),
    updateCandidateStage: (id: number, tcId: number, stage: string) => req<TicketCandidate>("PATCH", `/enterprise/tickets/${id}/candidates/${tcId}`, { stage }),
    removeCandidate: (id: number, tcId: number) => req<void>("DELETE", `/enterprise/tickets/${id}/candidates/${tcId}`),
    workload: () => req<WorkloadSummary>("GET", "/enterprise/tickets/workload/summary"),
  },
  webhooks: {
    getConfig: () => req<WebhookConfig | null>("GET", "/enterprise/webhooks/config"),
    saveConfig: (data: { url: string; enabledEvents?: string[]; enabled?: boolean; description?: string }) =>
      req<WebhookConfig>("PUT", "/enterprise/webhooks/config", data),
    deleteConfig: () => req<void>("DELETE", "/enterprise/webhooks/config"),
    getDeliveries: (limit = 50) => req<WebhookDelivery[]>("GET", `/enterprise/webhooks/deliveries?limit=${limit}`),
    testEvent: (event: string) => req<{ queued: boolean; event: string; message: string }>("POST", `/enterprise/webhooks/test/${event}`),
    getEvents: () => req<{ events: string[] }>("GET", "/enterprise/webhooks/events"),
  },
};

export const TICKET_STATUSES = ["Draft", "Open", "Sourcing", "Screening", "Interviewing", "Offer", "Closed"] as const;
export const TICKET_PRIORITIES = ["Critical", "High", "Medium", "Low"] as const;
export const CANDIDATE_STAGES = ["Applied", "Screening", "Interview", "Final", "Offered", "Hired", "Rejected"] as const;

export const PRIORITY_COLORS: Record<string, string> = {
  Critical: "border-red-400 text-red-700 bg-red-50",
  High: "border-orange-400 text-orange-700 bg-orange-50",
  Medium: "border-yellow-400 text-yellow-700 bg-yellow-50",
  Low: "border-gray-300 text-gray-600 bg-gray-50",
};

export const SLA_BADGE: Record<string, { cls: string }> = {
  ok: { cls: "bg-green-100 text-green-700" },
  warning: { cls: "bg-amber-100 text-amber-700" },
  critical: { cls: "bg-orange-100 text-orange-800" },
  breached: { cls: "bg-red-100 text-red-700" },
};

export interface Ticket {
  id: number;
  tenantId: number;
  title: string;
  jobDescriptionId: number | null;
  status: string;
  priority: string;
  assignedTo: string;
  hiringManagerId: number | null;
  department: string | null;
  location: string | null;
  salaryRange: string | null;
  openings: number;
  filled: number;
  targetStartDate: string | null;
  closeReason: string | null;
  tags: string;
  description: string | null;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
  sla: {
    daysRemaining: number;
    slaBreach: boolean;
    slaStatus: "ok" | "warning" | "critical" | "breached";
    deadline: string;
    pct: number;
  };
}

export interface TicketComment { id: number; ticketId: number; userId: number; authorName: string; content: string; createdAt: string; }
export interface TicketHistory { id: number; ticketId: number; userId: number; authorName: string; field: string; oldValue: string | null; newValue: string | null; changedAt: string; }
export interface TicketCandidate {
  id: number; ticketId: number; resumeProfileId: number; stage: string; note: string | null; addedBy: number | null;
  candidate: { id: number; candidateName: string | null; candidateEmail: string | null; fileName: string | null; candidateType: string; } | null;
}

export interface TicketDetail {
  ticket: Ticket;
  jd: { id: number; title: string; company: string | null; status: string } | null;
  candidates: TicketCandidate[];
  activity: Array<
    | { type: "comment"; id: number; authorName: string; content: string; at: string }
    | { type: "history"; id: number; authorName: string; field: string; oldValue: string | null; newValue: string | null; at: string }
  >;
}

export interface WorkloadSummary {
  totalTickets: number;
  openTickets: number;
  statusCounts: Record<string, number>;
  workload: Array<{ assignee: string; tickets: { id: number; title: string; status: string; priority: string }[]; breached: number; warning: number; ok: number }>;
}

export function getRagStats() {
  return req<{ totalChunks: number; indexedResumes: number }>("GET", "/enterprise/rag/stats");
}

export function ragIngestAll() {
  return req<{ resumes: number; chunks: number }>("POST", "/enterprise/rag/ingest-all");
}

export interface RagSource {
  resumeProfileId: number;
  candidateName: string;
  candidateEmail: string | null;
  section: string;
  snippet: string;
  bm25Score: number;
}

export interface RagResult {
  answer: string;
  sources: RagSource[];
  question: string;
  chunksSearched: number;
  chunksUsed: number;
}

export function ragQuery(question: string, topK = 8) {
  return req<RagResult>("POST", "/enterprise/rag/query", { question, topK });
}
