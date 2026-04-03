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
};
