# MatchPoint Enterprise — Minimal Azure Deployment
**Single App Service · PostgreSQL · ~$25/month**

---

## Architecture

```
Browser
  │
  ▼
Azure App Service (Linux, B1)
  ├── /api/*   → Express API routes
  └── /*       → React SPA (served as static files by Express)
  │
  ▼
Azure Database for PostgreSQL
Flexible Server (B1ms)
```

One App Service handles everything. Express serves the built React SPA as static files alongside the API routes — no separate frontend hosting, no CDN, no Front Door.

**Automatic HTTPS** is included free on every App Service at `https://<app-name>.azurewebsites.net`.

---

## Cost

| Service | Tier | Cost/month |
|---|---|---|
| Azure App Service | B1 Linux | ~$13 |
| Azure Database for PostgreSQL | Flexible Server B1ms, 32 GB | ~$12 |
| **Total** | | **~$25** |

---

## Prerequisites

- Azure CLI installed and signed in: `az login`
- Node.js 24 and pnpm installed locally
- A strong `SESSION_SECRET` — generate one:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- Your OpenAI API key

---

## Step 1 — Set Shell Variables

Run these once in your terminal. All commands below use them.

```bash
RG="matchpoint-rg"
LOCATION="eastus"
APP="matchpoint-app"
PLAN="matchpoint-plan"
DB_SERVER="matchpoint-db"
DB_NAME="matchpointdb"
DB_USER="matchpointadmin"
DB_PASS="<strong-password>"
```

---

## Step 2 — Create Resource Group

```bash
az group create --name $RG --location $LOCATION
```

---

## Step 3 — Create PostgreSQL Database

```bash
az postgres flexible-server create \
  --resource-group $RG \
  --name $DB_SERVER \
  --location $LOCATION \
  --admin-user $DB_USER \
  --admin-password $DB_PASS \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --storage-size 32 \
  --version 16 \
  --public-access 0.0.0.0

az postgres flexible-server db create \
  --resource-group $RG \
  --server-name $DB_SERVER \
  --database-name $DB_NAME

az postgres flexible-server parameter set \
  --resource-group $RG \
  --server-name $DB_SERVER \
  --name azure.extensions \
  --value VECTOR
```

Your connection string:
```
postgresql://<DB_USER>:<DB_PASS>@<DB_SERVER>.postgres.database.azure.com/<DB_NAME>?sslmode=require
```

---

## Step 4 — Create App Service

```bash
az appservice plan create \
  --resource-group $RG \
  --name $PLAN \
  --location $LOCATION \
  --sku B1 \
  --is-linux

az webapp create \
  --resource-group $RG \
  --plan $PLAN \
  --name $APP \
  --runtime "NODE:24-lts"
```

---

## Step 5 — Configure the Express Server to Serve the SPA

Add static file serving to the Express app so it serves the built React SPA for all non-API routes.

In `artifacts/api-server/src/app.ts`, add these lines **after** all API routes are registered:

```typescript
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

// Serve the React SPA for all non-API routes (production only)
const spaDistPath = path.resolve(process.cwd(), "../../artifacts/resume-matcher/dist");

if (existsSync(spaDistPath)) {
  app.use(express.static(spaDistPath));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(spaDistPath, "index.html"));
  });
}
```

This serves the built SPA as static files and falls back to `index.html` for all client-side routes (so reloading `/interviews` or `/tickets/1` works correctly).

---

## Step 6 — Set Environment Variables

```bash
DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@${DB_SERVER}.postgres.database.azure.com/${DB_NAME}?sslmode=require"

az webapp config appsettings set \
  --resource-group $RG \
  --name $APP \
  --settings \
    DATABASE_URL="$DATABASE_URL" \
    SESSION_SECRET="<your-32-byte-hex-secret>" \
    OPENAI_API_KEY="<your-openai-api-key>" \
    NODE_ENV="production" \
    PORT="8080"
```

Set the startup command:

```bash
az webapp config set \
  --resource-group $RG \
  --name $APP \
  --startup-file "node artifacts/api-server/dist/index.mjs"
```

---

## Step 7 — Push Database Schema

Run this locally before first deploy:

```bash
DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@${DB_SERVER}.postgres.database.azure.com/${DB_NAME}?sslmode=require" \
  pnpm --filter @workspace/db run push
```

---

## Step 8 — Build and Deploy

### Option A: Zip Deploy (one-off, no CI/CD)

```bash
# Build everything
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/resume-matcher run build

# Create a deployment zip (include everything App Service needs)
zip -r deploy.zip . \
  --exclude "*.git*" \
  --exclude "node_modules/.cache/*" \
  --exclude "artifacts/mockup-sandbox/*" \
  --exclude ".local/*"

# Deploy
az webapp deploy \
  --resource-group $RG \
  --name $APP \
  --src-path deploy.zip \
  --type zip
```

### Option B: GitHub Actions (automatic deploys on push)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Azure

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm

      - run: pnpm install --frozen-lockfile
      - run: pnpm run typecheck
      - run: pnpm --filter @workspace/api-server run build
      - run: pnpm --filter @workspace/resume-matcher run build

      - name: Push DB schema
        run: pnpm --filter @workspace/db run push
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}

      - name: Deploy to Azure App Service
        uses: azure/webapps-deploy@v3
        with:
          app-name: matchpoint-app
          publish-profile: ${{ secrets.AZURE_PUBLISH_PROFILE }}
          package: .
```

Get the publish profile from Azure Portal:
> App Service → your app → **Get publish profile** (download the XML file)

Paste its contents as the GitHub secret `AZURE_PUBLISH_PROFILE`.

Add `DATABASE_URL` as a second GitHub secret with the full connection string.

---

## Step 9 — Allow App Service IPs on the Database Firewall

```bash
OUTBOUND_IPS=$(az webapp show \
  --resource-group $RG \
  --name $APP \
  --query outboundIpAddresses \
  --output tsv)

for IP in $(echo $OUTBOUND_IPS | tr ',' ' '); do
  az postgres flexible-server firewall-rule create \
    --resource-group $RG \
    --name $DB_SERVER \
    --rule-name "appservice-$IP" \
    --start-ip-address $IP \
    --end-ip-address $IP
done
```

---

## Step 10 — Verify

```bash
# Health check
curl https://<app-name>.azurewebsites.net/api/health
# Expected: {"status":"ok"}

# Tail live logs
az webapp log tail --resource-group $RG --name $APP
```

Open `https://<app-name>.azurewebsites.net` in the browser — the React app should load. Register an organisation and confirm the full sign-in flow works.

---

## Upgrade Path

When you need more, add these in order:

| When | Add |
|---|---|
| Need custom domain + better TLS control | Azure Front Door Standard (~$35/month) |
| Secrets too exposed in App Settings | Azure Key Vault (~$1/month) + managed identity |
| Need global CDN for the SPA | Move frontend to Azure Static Web Apps (~$9/month) |
| Need more API performance | Scale App Service to P1v3 (~$75/month) |
| Need higher DB performance | Scale PostgreSQL to General Purpose D2s (~$90/month) |
