# Synesis Enterprise

AI-driven talent intelligence platform — enterprise-grade resume and JD matching.

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, TailwindCSS v4, shadcn/ui |
| Backend | Express 5, Node.js, TypeScript |
| Database | PostgreSQL + Drizzle ORM |
| Auth | JWT + bcryptjs |

## Project Structure

```
synesis/
├── client/          # React + Vite frontend
├── server/          # Express + Node backend
├── shared/          # Shared TypeScript types
├── package.json     # Root workspace
└── pnpm-workspace.yaml
```

## Getting Started

### Prerequisites
- Node.js 20+
- pnpm 9+
- PostgreSQL 15+

### Setup

```bash
# Install all dependencies
pnpm install

# Copy environment variables
cp .env.example .env
# Edit .env with your DATABASE_URL, JWT_SECRET, etc.

# Start both client and server in one command
pnpm dev
```

The client runs on `http://localhost:5173` and the server on `http://localhost:5000`.

### Default Login

| Field | Value |
|-------|-------|
| Email | admin@example.com |
| Password | admin123 |

### Individual Commands

```bash
pnpm --filter client dev     # Frontend only
pnpm --filter server dev     # Backend only
pnpm --filter client build   # Build frontend
```

## Environment Variables

See `.env.example` for required variables.
