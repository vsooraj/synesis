# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **AI**: OpenAI via Replit AI Integrations (gpt-5.2)

## Artifacts

### Resume & JD Matcher (`artifacts/resume-matcher`)
- React + Vite frontend at `/`
- Resume and job description matching app powered by AI
- Features: analyzer, detailed results, history, stats dashboard

### API Server (`artifacts/api-server`)
- Express 5 backend at `/api`
- Routes: `/api/resume/analyze`, `/api/resume/analyses`, `/api/resume/stats`

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Database Schema

- `analyses` — stores resume analysis results with scores, keywords, strengths, gaps, suggestions

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
