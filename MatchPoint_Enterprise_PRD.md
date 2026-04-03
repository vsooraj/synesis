# Product Requirements Document
## MatchPoint Enterprise — AI-Powered Talent Intelligence Platform

**Version:** 1.0  
**Date:** April 3, 2026  
**Status:** Draft  
**Author:** Sooraj Vidyasagar  
**Stack:** Python · FastAPI · PostgreSQL · pgvector · Claude AI

---

## Table of Contents

1. [Overview](#1-overview)
2. [Goals & Success Metrics](#2-goals--success-metrics)
3. [Users & Roles](#3-users--roles)
4. [Multi-Tenancy](#4-multi-tenancy)
5. [Features](#5-features)
6. [AI Architecture](#6-ai-architecture)
7. [Data Model](#7-data-model)
8. [API Design](#8-api-design)
9. [Tech Stack](#9-tech-stack)
10. [Project Structure](#10-project-structure)
11. [Non-Functional Requirements](#11-non-functional-requirements)
12. [Security & Compliance](#12-security--compliance)
13. [Phased Rollout](#13-phased-rollout)
14. [Out of Scope](#14-out-of-scope-v1-enterprise)
15. [Future Considerations](#15-future-considerations)

---

## 1. Overview

### 1.1 Product Summary
MatchPoint Enterprise is a multi-tenant, AI-powered talent intelligence platform that enables organisations to match candidates and employees against job descriptions at scale. It combines large language model reasoning with semantic vector search (pgvector) and agentic workflows to deliver resume scoring, talent pool discovery, skills gap analytics, and automated shortlisting — all within a secure, auditable enterprise environment.

### 1.2 Problem Statement
At the scale of 1,000+ employees across multiple departments:

- HR teams cannot manually review every resume against every open role
- Skills gaps exist across departments but are invisible without aggregation
- Internal mobility is underutilised — qualified employees are overlooked for new roles
- Resume matching is inconsistent across hiring managers
- No audit trail exists for AI-assisted hiring decisions

### 1.3 Solution
MatchPoint Enterprise provides:

1. **Individual analysis** — AI scores any resume against any JD (v1 feature, extended)
2. **Bulk analysis** — Upload 50+ resumes, match all against one JD asynchronously
3. **Talent pool search** — Semantic vector search across all employee/candidate resumes
4. **Skills gap analytics** — Aggregate department-level skills intelligence
5. **Agentic shortlisting** — Automated multi-step candidate ranking and reporting

---

## 2. Goals & Success Metrics

| Goal | Metric |
|---|---|
| Reduce time-to-shortlist | From days to under 1 hour for a 50-resume bulk job |
| Improve match quality | Hiring manager satisfaction score ≥ 4/5 on shortlist relevance |
| Surface internal talent | ≥ 20% of open roles filled from internal talent pool |
| Provide skills visibility | Department skills gap report available within 24h of request |
| Ensure compliance | 100% of AI decisions have audit trail entry |

---

## 3. Users & Roles

| Role | Description | Permissions |
|---|---|---|
| Super Admin | Platform owner / IT admin | Full access, tenant management, billing |
| HR Admin | HR department head | Manage users, run bulk jobs, view all analyses |
| Hiring Manager | Department manager posting roles | Create JDs, view analyses for their roles |
| Employee | Individual contributor | Upload own resume, view own analyses |
| Recruiter | Talent acquisition team | Run analyses, manage candidate pool |

---

## 4. Multi-Tenancy

- Each organisation is a **Tenant**
- All data is isolated by `tenant_id` at the database row level
- Tenant onboarding via Super Admin; SSO configured per tenant (OAuth2 / OIDC)
- Per-tenant configuration: token budgets, allowed AI features, data retention policy
- Schema: **shared database, tenant-scoped rows** (not schema-per-tenant)

---

## 5. Features

### 5.1 Phase 1 — Foundation (Months 1–2)

#### 5.1.1 Authentication & Authorisation
- OAuth2 / OIDC integration (supports Azure Entra ID, Google Workspace, Okta)
- JWT-based session tokens
- RBAC enforcement on every API endpoint
- Per-tenant SSO configuration

#### 5.1.2 User-Scoped Resume Analysis (Enhanced v1)
- Same core flow as MatchPoint v1 (resume + JD → AI score)
- Now persisted per user, per tenant
- PDF / TXT upload stored in object storage (S3-compatible)
- Full audit log entry per analysis

#### 5.1.3 Resume Storage & Profile
- Each employee/candidate has a **Resume Profile**
- Stores: raw PDF (object storage), extracted text, structured metadata
- On upload: text extracted → embedding generated → stored in pgvector
- Profiles are versioned (resume v1, v2, etc.)

---

### 5.2 Phase 2 — Scale (Months 3–4)

#### 5.2.1 Bulk Analysis
- HR Admin uploads a ZIP or selects multiple resumes from the talent pool
- Selects a target JD
- Job submitted to async queue (Celery + Redis)
- Worker processes each resume → Claude API → score stored
- Progress tracked in real time (WebSocket or polling)
- Results page: ranked table of all candidates with scores, exportable to CSV

#### 5.2.2 Job Postings Management
- CRUD for Job Descriptions within a tenant
- JD stored as text + embedding (pgvector)
- Status: `Draft` / `Active` / `Closed`
- Linked to analyses and shortlist reports

#### 5.2.3 Candidate Pool
- Unified view of all resumes ingested (employees + external candidates)
- Tag candidates: `Internal` / `External` / `Contractor`
- Filter by department, skills, score range, last active date

---

### 5.3 Phase 3 — Intelligence (Months 5–6)

#### 5.3.1 Talent Pool Search (RAG)
- HR types a natural language query: *"Find engineers with Kubernetes and Python experience"*
- Query is embedded → cosine similarity search against all resume embeddings in pgvector
- Top-N results returned with similarity scores
- Results can be fed directly into a bulk analysis job against a chosen JD

**Vector Search Flow:**
```
Query text
  → Embed (text-embedding-3-large or equivalent)
  → pgvector cosine similarity search
  → Top-K resume chunks retrieved
  → Re-ranked by Claude (optional)
  → Results returned
```

#### 5.3.2 Skills Gap Analytics
- Aggregates all analysis results across a department
- Identifies most common gaps across the team
- Surfaces: *"60% of your Engineering team lacks cloud architecture skills"*
- Drill-down to individual employees
- Exportable as PDF report

#### 5.3.3 Internal Mobility Matching
- When a new JD is posted, auto-match against all employee resume embeddings
- Notify HR of internal candidates who score ≥ threshold (configurable)
- Employee can opt in/out of internal mobility matching

---

### 5.4 Phase 4 — Agents (Months 7–8)

#### 5.4.1 Agentic Shortlisting Pipeline
Triggered manually by HR Admin or automatically on JD activation.

**Agent Steps (LangChain / ReAct pattern):**

| Step | Action |
|---|---|
| 1 | Retrieve JD embedding → search talent pool (pgvector) |
| 2 | Retrieve top-50 candidate resumes |
| 3 | For each candidate: run detailed AI analysis (Claude) |
| 4 | Score and rank all candidates |
| 5 | Filter by configurable threshold (e.g., score ≥ 70) |
| 6 | Generate shortlist report (PDF / markdown) |
| 7 | Notify hiring manager (email / webhook) |
| 8 | Log all steps to audit trail |

#### 5.4.2 Agent Tools / Plugins

| Tool | Description |
|---|---|
| `search_talent_pool` | pgvector similarity search over resume embeddings |
| `analyze_resume` | Claude API: score resume vs JD |
| `get_jd` | Fetch JD text and metadata |
| `generate_report` | Render shortlist as structured markdown/PDF |
| `notify_manager` | Send email or webhook notification |
| `log_audit` | Write immutable audit entry |

#### 5.4.3 Human-in-the-Loop
- Agent pauses before sending shortlist notification
- HR Admin reviews and approves/edits shortlist
- Approval is logged in audit trail
- Rejected candidates receive no notification

---

## 6. AI Architecture

### 6.1 Embedding Model
- **Model:** `text-embedding-3-large` (OpenAI) or Claude embeddings via Anthropic
- **Dimensions:** 3072 (`text-embedding-3-large`) or 1536
- **Stored in:** pgvector column on `resume_embeddings` and `jd_embeddings` tables
- **Chunking strategy:** Resume split into sections (Summary, Experience, Skills, Education) — each chunk embedded separately for finer retrieval

### 6.2 Analysis Model
- **Model:** Claude Sonnet (latest) via Anthropic API
- **Call type:** Single-turn structured JSON response
- **Token budget:** ~6,000 tokens per analysis (resume + JD + prompt + response)
- **Rate limiting:** Per-tenant token budget enforced via Redis counter

### 6.3 Agent Orchestrator
- **Framework:** LangChain (Python) or custom async tool loop
- **Pattern:** ReAct (Reasoning + Acting) — agent reasons before each tool call
- **State:** Persisted in PostgreSQL between steps (resumable on failure)
- **Max steps:** Configurable per tenant (default 20)

### 6.4 RAG Pipeline

**Ingest:**
```
PDF upload → extract text → chunk by section
  → embed each chunk → store in pgvector
  → store chunk metadata (resume_id, section, page)
```

**Query:**
```
Natural language query → embed
  → pgvector ANN search (ivfflat or hnsw index)
  → retrieve top-K chunks with metadata
  → optionally re-rank with Claude
  → return to caller
```

---

## 7. Data Model

### Core Tables

```sql
-- Tenants
tenants (id, name, domain, sso_config jsonb, token_budget int, created_at)

-- Users
users (id, tenant_id, email, name, role, oauth_sub, created_at)

-- Resume Profiles
resume_profiles (
    id, tenant_id, user_id, candidate_type,  -- Internal/External
    file_url, extracted_text, version,
    created_at, updated_at
)

-- Resume Embeddings (pgvector)
resume_embeddings (
    id, resume_profile_id, tenant_id,
    chunk_text, section,                     -- Summary/Experience/Skills/Education
    embedding vector(3072),                  -- pgvector column
    created_at
)

-- Job Descriptions
job_descriptions (
    id, tenant_id, created_by,
    title, company, description_text,
    status,                                  -- Draft/Active/Closed
    embedding vector(3072),
    created_at, updated_at
)

-- Analyses
analyses (
    id, tenant_id, created_by,
    resume_profile_id, job_description_id,
    overall_score real, summary text,
    strengths jsonb, gaps jsonb,
    matched_keywords jsonb, missing_keywords jsonb,
    suggestions jsonb, section_scores jsonb,
    created_at
)

-- Bulk Jobs
bulk_jobs (
    id, tenant_id, created_by,
    job_description_id, status,              -- Pending/Running/Complete/Failed
    total int, processed int, failed int,
    created_at, completed_at
)

-- Audit Log (immutable)
audit_log (
    id, tenant_id, user_id,
    action, entity_type, entity_id,
    detail jsonb, ip_address,
    created_at                               -- No updates ever
)

-- Agent Run Log
agent_runs (
    id, tenant_id, job_description_id,
    status, steps jsonb,                     -- Each step's input/output
    shortlist jsonb, approved_by,
    created_at, completed_at
)
```

### pgvector Indexes

```sql
-- HNSW index for fast approximate nearest neighbour search
CREATE INDEX ON resume_embeddings
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

CREATE INDEX ON job_descriptions
    USING hnsw (embedding vector_cosine_ops);
```

---

## 8. API Design

### Authentication

| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/login` | OAuth2 token exchange |
| POST | `/auth/refresh` | Refresh JWT |
| GET | `/auth/me` | Current user profile |

### Resumes

| Method | Endpoint | Description |
|---|---|---|
| POST | `/resumes` | Upload resume (PDF/TXT) |
| GET | `/resumes` | List resumes (tenant-scoped) |
| GET | `/resumes/{id}` | Get resume profile |
| DELETE | `/resumes/{id}` | Delete resume + embeddings |
| GET | `/resumes/search?q=` | Semantic search (pgvector) |

### Job Descriptions

| Method | Endpoint | Description |
|---|---|---|
| POST | `/jobs` | Create JD |
| GET | `/jobs` | List JDs |
| PUT | `/jobs/{id}` | Update JD |
| DELETE | `/jobs/{id}` | Delete JD |

### Analyses

| Method | Endpoint | Description |
|---|---|---|
| POST | `/analyses` | Run single analysis |
| GET | `/analyses` | List analyses (filtered) |
| GET | `/analyses/{id}` | Get analysis detail |
| DELETE | `/analyses/{id}` | Delete analysis |
| GET | `/analyses/stats` | Aggregate stats |

### Bulk Jobs

| Method | Endpoint | Description |
|---|---|---|
| POST | `/bulk-jobs` | Submit bulk analysis job |
| GET | `/bulk-jobs/{id}` | Get job status + results |
| GET | `/bulk-jobs/{id}/results` | Paginated ranked results |
| GET | `/bulk-jobs/{id}/export` | CSV export |

### Agent

| Method | Endpoint | Description |
|---|---|---|
| POST | `/agent/shortlist` | Trigger agentic shortlisting |
| GET | `/agent/runs/{id}` | Get agent run status + steps |
| POST | `/agent/runs/{id}/approve` | HR approves shortlist |

### Analytics

| Method | Endpoint | Description |
|---|---|---|
| GET | `/analytics/skills-gap` | Department skills gap report |
| GET | `/analytics/mobility` | Internal mobility matches |
| GET | `/analytics/usage` | Token usage by dept/user |

---

## 9. Tech Stack

| Layer | Technology |
|---|---|
| Language | Python 3.12 |
| API Framework | FastAPI |
| ORM | SQLAlchemy 2.0 + Alembic (migrations) |
| Database | PostgreSQL 16 + pgvector extension |
| Async Queue | Celery + Redis |
| Object Storage | AWS S3 / MinIO (PDF originals) |
| Embedding | OpenAI `text-embedding-3-large` or Anthropic |
| AI Analysis | Anthropic Claude Sonnet (latest) |
| Agent Framework | LangChain (Python) |
| Auth | FastAPI-Users + python-jose (JWT) |
| Real-time | WebSockets (FastAPI native) |
| Cache / Rate limit | Redis |
| PDF Extraction | PyMuPDF (`fitz`) |
| Testing | pytest + httpx |
| Containerisation | Docker + Docker Compose |
| CI/CD | GitHub Actions |

---

## 10. Project Structure

```
matchpoint-enterprise/
├── app/
│   ├── api/
│   │   ├── routes/
│   │   │   ├── auth.py
│   │   │   ├── resumes.py
│   │   │   ├── jobs.py
│   │   │   ├── analyses.py
│   │   │   ├── bulk.py
│   │   │   ├── agent.py
│   │   │   └── analytics.py
│   │   └── deps.py               # Auth + DB dependencies
│   ├── core/
│   │   ├── config.py             # Settings (pydantic-settings)
│   │   ├── security.py           # JWT, password hashing
│   │   └── logging.py
│   ├── models/                   # SQLAlchemy ORM models
│   ├── schemas/                  # Pydantic request/response schemas
│   ├── services/
│   │   ├── analysis_service.py   # Claude API calls
│   │   ├── embedding_service.py  # Embed + store in pgvector
│   │   ├── search_service.py     # pgvector similarity search
│   │   ├── pdf_service.py        # PyMuPDF extraction
│   │   ├── bulk_service.py       # Celery task orchestration
│   │   └── agent_service.py      # LangChain agent loop
│   ├── workers/
│   │   ├── celery_app.py
│   │   └── tasks.py              # Bulk analysis tasks
│   └── main.py
├── alembic/                      # DB migrations
├── tests/
├── docker-compose.yml
├── Dockerfile
└── requirements.txt
```

---

## 11. Non-Functional Requirements

| Requirement | Target |
|---|---|
| Single analysis latency | < 30 seconds |
| Bulk job throughput | 50 resumes processed in < 15 minutes |
| Vector search latency | < 500ms for 1M embeddings (HNSW index) |
| API uptime | 99.5% |
| Data isolation | Zero cross-tenant data leakage |
| Audit completeness | 100% of AI actions logged |
| Token cost control | Per-tenant hard cap enforced before API call |
| GDPR | Resume data deletable on request (right to erasure) |

---

## 12. Security & Compliance

- All data encrypted at rest (AES-256) and in transit (TLS 1.3)
- Resume PDFs stored in private S3 bucket, accessed via pre-signed URLs
- PII fields (email, name) separable from analysis data
- Audit log is **append-only** (no `UPDATE`/`DELETE` on `audit_log` table)
- GDPR: `DELETE /resumes/{id}` cascades to embeddings and anonymises analyses
- Role checks enforced at service layer, not just route layer
- Rate limiting: per-user (10 analyses/hour), per-tenant (token budget)

---

## 13. Phased Rollout

| Phase | Duration | Deliverables |
|---|---|---|
| Phase 1 — Foundation | 8 weeks | Auth, user profiles, resume upload + embedding, single analysis, audit log |
| Phase 2 — Scale | 8 weeks | Bulk jobs (Celery), JD management, candidate pool UI, CSV export |
| Phase 3 — Intelligence | 8 weeks | pgvector talent search, skills gap analytics, internal mobility matching |
| Phase 4 — Agents | 8 weeks | LangChain agent shortlisting, human-in-the-loop approval, agent audit trail |

**Total estimated delivery: 32 weeks (~8 months)**

---

## 14. Out of Scope (v1 Enterprise)

- Video interview analysis
- Psychometric assessments
- Payroll / HRIS integration
- Mobile native app
- Fine-tuned domain-specific model

---

## 15. Future Considerations

- **Fine-tuning** — Train a domain-specific model on historical hiring outcomes
- **Bias detection** — Audit AI scores for demographic bias patterns
- **HRIS connectors** — Sync with Workday, BambooHR, SAP SuccessFactors
- **Interview prep** — Generate interview question packs from gap analysis
- **Offer benchmarking** — Integrate market salary data into match reports
