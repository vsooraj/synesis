# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.
MatchPoint Enterprise — AI-powered talent intelligence platform.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM + pgvector (enabled)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **AI**: OpenAI via Replit AI Integrations (gpt-5.2 for analysis, text-embedding-3-small for embeddings)
- **Auth**: JWT (jsonwebtoken) + bcryptjs, RBAC with 5 roles
- **File upload**: multer + pdf-parse

## Artifacts

### Resume & JD Matcher (`artifacts/resume-matcher`)
- React + Vite frontend at `/`
- Enterprise talent intelligence app with full auth
- **Public pages**: Analyzer, Results, History, Stats
- **Enterprise pages** (auth required): Candidates, Job Descriptions, Bulk Analysis, Team, Audit Log
- Auth: JWT stored in localStorage, AuthContext wraps the app
- Role-based nav: enterprise items hidden/shown by role

### API Server (`artifacts/api-server`)
- Express 5 backend at `/api`
- **Public routes**: `/api/resume/analyze`, `/api/resume/analyses`, `/api/resume/stats`
- **Auth routes**: `/api/auth/register`, `/api/auth/login`, `/api/auth/me`, `/api/auth/users`
- **Enterprise routes**: `/api/enterprise/resumes`, `/api/enterprise/jobs`, `/api/enterprise/bulk-jobs`, `/api/enterprise/audit-log`

## Database Schema

- `analyses` — resume analysis results (scores, keywords, strengths, gaps, suggestions)
- `tenants` — multi-tenant organisations
- `users` — users with roles (super_admin, hr_admin, hiring_manager, recruiter, employee)
- `resume_profiles` — candidate resume storage with embeddings
- `job_descriptions` — JD management with status (Draft/Active/Closed) and embeddings
- `bulk_jobs` — async bulk analysis jobs
- `bulk_job_results` — individual results per candidate per bulk job
- `audit_log` — immutable append-only action log

## User Roles

| Role | Permissions |
|------|-------------|
| super_admin | Full access, user management, tenant config |
| hr_admin | All analyses, bulk jobs, user management |
| hiring_manager | Create JDs, view analyses for their roles |
| recruiter | Run analyses, manage candidate pool |
| employee | Upload own resume, view own analyses |

## Enterprise Features (All Phases)

- **Multi-tenancy**: All data isolated by tenant_id
- **JWT Auth**: Register org → get token → access enterprise features
- **Resume Pool**: Upload PDF or paste text, sanitized & stored
- **JD Management**: Create/edit/delete job descriptions with Draft/Active/Closed status
- **Bulk Analysis**: Submit N candidates against one JD, async background processing, CSV export
- **Audit Log**: Append-only record of every enterprise action
- **Talent Pool Search** (Phase 3): TF-IDF semantic search across all candidate resumes with best-snippet highlighting
- **Skills Gap Analytics** (Phase 3): Aggregate gap/strength frequency from all analyses, score distribution charts, section score radial charts
- **AI Shortlisting Agent** (Phase 4): Async agentic pipeline — TF-IDF ranks candidates → GPT-5.2 analyses each → ranked shortlist report → HR approves/rejects (human-in-the-loop), full agent step log

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
