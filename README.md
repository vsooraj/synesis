# Synesis Enterprise — AI-Driven Talent Intelligence

Synesis is a full-stack Enterprise-ready recruitment platform. It leverages AI (LLMs), pgvector semantic search, and agentic workflows to automate resume screening, candidate ranking, and interview scheduling.

## 🚀 Key Features

- **Resume Matcher**: AI-powered analysis of resumes against job descriptions with scoring and gap identification.
*   **Bulk Analysis**: Screen hundreds of candidates asynchronously using background workers.
*   **Talent Pool & RAG Search**: Semantic search over candidate/employee profiles using pgvector and RAG (Retrieval-Augmented Generation).
*   **Agentic AI Shortlisting**: An autonomous pipeline that ranks candidates and generates detailed reports for HR approval.
*   **n8n Integration Hub**: Webhook-driven automation for Gmail outreach, Microsoft Teams notifications, and Outlook scheduling.
*   **Interview Scheduling**: Structured timeline-based scheduling with automated feedback collection and Adaptive Card notifications.
*   **Enterprise Management**: Multi-tenancy, RBAC (Super Admin to Employee), and immutable audit logs for every system action.
- **HR Ticketing (Phase 7)**: Full Kanban-based position tracking system with SLA monitoring.

## 📸 Visual Overview

### Core Workflow
![Home & Analyzer](file:///d:/synesis/screenshots/manual/01-home-analyzer.jpg)
*AI-powered Resume Matching and Analysis.*

### Enterprise Features
![Talent Pool Search](file:///d:/synesis/screenshots/manual/09-talent.jpg)
*Semantic Talent Search (pgvector) and Analytics.*

### Agentic AI & RAG
![Agentic AI Shortlisting](file:///d:/synesis/screenshots/manual/11-agent.jpg)
*Autonomous Agent for Ranking and Reporting.*

### Integrations
![n8n Integration Hub](file:///d:/synesis/screenshots/manual/16-integrations.jpg)
*n8n Integration Hub for Workflow Automation.*

## 🏗 Architecture

The project is structured as a **PNPM Monorepo**, ensuring clean isolation between the frontend, backend, and core libraries.

- **Frontend (`/apps/client`)**: React 19 + Vite + Tailwind 4. Built into static assets served by the backend.
- **Backend (`/apps/server`)**: Express 5 + Node.js (TypeScript). Handles the API, auth, business logic, and in-process background tasks.
- **Core Packages (`/packages/*`)**:
    - `@workspace/db`: Drizzle ORM + Schema for PostgreSQL.
    - `@workspace/api-spec`: OpenAPI-first contracts and code generation.
    - `@workspace/api-zod`: Shared validation schemas.
    - `@workspace/integrations-*`: Reusable modules for OpenAI/Claude/n8n.
- **Integrations**: Connects to **n8n** for external workflow automation via signed webhooks.

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, Radix UI, TanStack Query, shadcn/ui |
| **Backend** | Node.js, Express 5, TypeScript |
| **Database** | PostgreSQL 16 + `pgvector` (for semantic search) |
| **ORM** | Drizzle |
| **AI** | OpenAI (GPT-5.2), Anthropic (Claude), pgvector (RAG) |
| **Integrations** | n8n (Webhook-driven) |

## 🚦 Getting Started

### Prerequisites
- Node.js 20+
- pnpm 9+
- PostgreSQL 16+ (with `pgvector` extension)

### Setup
1.  **Create Database**:
    Ensure you have a PostgreSQL database named `Synesis`.
2.  **Install dependencies**:
    ```bash
    pnpm install
    ```
3.  **Environment Setup**:
    Copy `.env.example` to `.env` and configure:
    - `DATABASE_URL` (e.g., `postgresql://postgres:admin123@localhost:5432/Synesis`)
    - `JWT_SECRET`
    - `OPENAI_API_KEY`
4.  **Database Migration**:
    ```bash
    pnpm exec drizzle-kit push --config ./packages/db/drizzle.config.ts
    ```
5.  **Run Development**:
    ```bash
    pnpm dev
    ```

## 📖 API Documentation & Swagger

Synesis follows an **API-First** approach. The platform includes a built-in **Swagger UI** for testing and exploring the Enterprise API.

- **Access URL**: `http://localhost:5000/api-docs/`
- **Spec Source**: [openapi.yaml](file:///d:/synesis/packages/api-spec/openapi.yaml)
- **Features**: Includes full documentation for Auth, Tickets, Interviews, Bulk Jobs, and Resume Analysis.
- **Authentication**: Supports JWT Bearer authorization directly in the UI.

## 🔌 n8n & External Automation

The platform integrates with **n8n** for workflow automation through a dynamic **Webhook System**.

- **Type**: Backend-to-n8n (Signed Webhooks).
- **Configuration**: Managed **per-tenant** in the app settings (stored in `webhook_configs` table).
- **Security**: Every webhook is signed with a random 32-byte secret (HMAC-SHA256) to ensure integrity.
- **n8n Templates**: Pre-built n8n JSON workflows can be found in [docs/n8n/](file:///d:/synesis/docs/n8n).
- **Supported Events**: `position.opened`, `interview.scheduled`, `shortlist.pending_approval`, `bulk_job.completed`, and more.

## 🚢 Deployment (Azure App Service)

The project is containerized for **Azure App Service for Containers**. 

### Deployable Units:
-   **API + Frontend**: A unified Docker container (see `/Dockerfile`) that builds the React client and serves it via the Express server on Port 5000.
-   **Database**: Azure Database for PostgreSQL (Flexible Server) with public access allowed from Azure services.
-   **Automation**: n8n instance (Self-hosted or Cloud) to handle external webhooks.

For a step-by-step guide on creating Azure resources and setting up GitHub Actions, see [docs/azure-deployment.md](file:///d:/synesis/docs/azure-deployment.md).
