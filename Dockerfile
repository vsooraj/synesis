# Use node version 20 as the base image
FROM node:20-slim AS base

# Install pnpm
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Set working directory
WORKDIR /app

# ---- Build Stage ----
FROM base AS build

# Copy workspace configuration and lock file
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./

# Copy package.json files for all workspaces to allow pnpm to install dependencies
COPY apps/client/package.json ./apps/client/
COPY apps/server/package.json ./apps/server/
COPY packages/api-client-react/package.json ./packages/api-client-react/
COPY packages/api-spec/package.json ./packages/api-spec/
COPY packages/api-zod/package.json ./packages/api-zod/
COPY packages/db/package.json ./packages/db/
COPY packages/integrations-openai-ai-react/package.json ./packages/integrations-openai-ai-react/
COPY packages/integrations-openai-ai-server/package.json ./packages/integrations-openai-ai-server/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy the rest of the application code
COPY . .

# Build everything
RUN pnpm run build

# ---- Production Stage ----
FROM base AS runner

# Set to production
ENV NODE_ENV=production

# Copy built assets and necessary files while preserving the monorepo structure
# This ensures that path.resolve(__dirname, "../../client/dist") works correctly
WORKDIR /app
COPY --from=build /app/apps/server/dist ./apps/server/dist
COPY --from=build /app/apps/client/dist ./apps/client/dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=build /app/package.json ./package.json

# Expose port (must match the PORT environment variable)
EXPOSE 5000
ENV PORT=5000

# Start the server (path is relative to /app)
CMD ["node", "./apps/server/dist/index.mjs"]
