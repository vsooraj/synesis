# MatchPoint Enterprise — Azure Deployment Guide
**Version 1.0 | Node.js 24 · Express 5 · React 19 · PostgreSQL**

---

## Table of Contents

1. [Azure Architecture Overview](#1-azure-architecture-overview)
2. [Azure Services Used](#2-azure-services-used)
3. [Prerequisites](#3-prerequisites)
4. [Step 1 — Provision Azure Database for PostgreSQL](#4-step-1--provision-azure-database-for-postgresql)
5. [Step 2 — Provision Azure App Service (API Server)](#5-step-2--provision-azure-app-service-api-server)
6. [Step 3 — Provision Azure Static Web Apps (Frontend)](#6-step-3--provision-azure-static-web-apps-frontend)
7. [Step 4 — Configure Azure Key Vault for Secrets](#7-step-4--configure-azure-key-vault-for-secrets)
8. [Step 5 — Configure Application Settings (Environment Variables)](#8-step-5--configure-application-settings-environment-variables)
9. [Step 6 — Push the Database Schema](#9-step-6--push-the-database-schema)
10. [Step 7 — Deploy via GitHub Actions (CI/CD)](#10-step-7--deploy-via-github-actions-cicd)
11. [Step 8 — Configure Path-Based Routing (Azure Front Door)](#11-step-8--configure-path-based-routing-azure-front-door)
12. [Step 9 — Custom Domain & TLS](#12-step-9--custom-domain--tls)
13. [Step 10 — Monitoring & Alerting](#13-step-10--monitoring--alerting)
14. [Post-Deployment Verification](#14-post-deployment-verification)
15. [Cost Estimate](#15-cost-estimate)
16. [Security Checklist](#16-security-checklist)
17. [Troubleshooting](#17-troubleshooting)

---

## 1. Azure Architecture Overview

```
                        ┌─────────────────────────────┐
                        │      Azure Front Door        │
                        │  (Global CDN + TLS + WAF)    │
                        │  matchpoint.yourdomain.com   │
                        └──────────────┬──────────────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    │  Path routing    │                   │
                    │                 │                   │
                    ▼                 ▼                   │
        ┌───────────────────┐  ┌──────────────────┐      │
        │ Azure Static Web  │  │ Azure App Service │      │
        │    Apps (SPA)     │  │   (API Server)    │      │
        │  React + Vite     │  │  Express 5 / ESM  │      │
        │  Route: /         │  │  Route: /api      │      │
        └───────────────────┘  └────────┬─────────┘      │
                                        │                  │
                         ┌──────────────┴────────────┐    │
                         │                           │    │
                         ▼                           ▼    │
              ┌─────────────────────┐   ┌────────────────────┐
              │  Azure Database for │   │  Azure Key Vault   │
              │  PostgreSQL         │   │  (Secrets)         │
              │  Flexible Server    │   │                    │
              └─────────────────────┘   └────────────────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │  Azure Monitor +    │
              │  Application        │
              │  Insights           │
              └─────────────────────┘
```

### Routing strategy

| Path | Service |
|---|---|
| `/api/*` | Azure App Service (Express API) |
| `/*` (everything else) | Azure Static Web Apps (React SPA) |

Azure Front Door sits in front of both services and routes requests based on path prefix. This gives you a single public domain with automatic HTTPS, global CDN for the SPA, and DDoS/WAF protection.

---

## 2. Azure Services Used

| Service | Tier recommendation | Purpose |
|---|---|---|
| **Azure App Service** | B2 or P1v3 | Hosts the Express API server |
| **Azure Static Web Apps** | Standard | Hosts the React + Vite SPA with global CDN |
| **Azure Database for PostgreSQL** | Flexible Server, Burstable B2s | Managed PostgreSQL with pgvector support |
| **Azure Key Vault** | Standard | Stores `SESSION_SECRET`, `OPENAI_API_KEY`, DB password |
| **Azure Front Door** | Standard | Path-based routing, CDN, WAF, TLS termination |
| **Azure Container Registry** *(optional)* | Basic | If you choose Docker-based deployment |
| **Azure Monitor + App Insights** | Pay-as-you-go | Logs, metrics, alerts |
| **Azure Resource Group** | — | Logical container for all resources |

---

## 3. Prerequisites

Before starting, ensure you have:

- **Azure subscription** with Contributor access
- **Azure CLI** installed and signed in: `az login`
- **Node.js 24** and **pnpm** installed locally
- **GitHub repository** containing the MatchPoint Enterprise source code
- The following values ready:
  - A strong `SESSION_SECRET` (32+ random bytes — generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
  - Your `OPENAI_API_KEY` (from OpenAI platform or Azure OpenAI)
- An Azure region selected — recommended: `eastus` or `westeurope`

### Install Azure CLI (if not already installed)

```bash
# macOS
brew install azure-cli

# Windows
winget install -e --id Microsoft.AzureCLI

# Ubuntu/Debian
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
```

Sign in:
```bash
az login
az account set --subscription "<your-subscription-id>"
```

### Set common variables (use these throughout this guide)

```bash
RESOURCE_GROUP="matchpoint-enterprise-rg"
LOCATION="eastus"
APP_NAME="matchpoint-api"
SWA_NAME="matchpoint-frontend"
DB_SERVER="matchpoint-db-server"
DB_NAME="matchpointdb"
DB_ADMIN_USER="matchpointadmin"
KEY_VAULT_NAME="matchpoint-kv"
APP_SERVICE_PLAN="matchpoint-plan"
FRONT_DOOR_NAME="matchpoint-fd"
```

Create the resource group first:

```bash
az group create --name $RESOURCE_GROUP --location $LOCATION
```

---

## 4. Step 1 — Provision Azure Database for PostgreSQL

### 4.1 Create the Flexible Server

```bash
az postgres flexible-server create \
  --resource-group $RESOURCE_GROUP \
  --name $DB_SERVER \
  --location $LOCATION \
  --admin-user $DB_ADMIN_USER \
  --admin-password "<strong-db-password>" \
  --sku-name Standard_B2s \
  --tier Burstable \
  --storage-size 32 \
  --version 16 \
  --high-availability Disabled \
  --public-access 0.0.0.0
```

> **Security note:** `--public-access 0.0.0.0` allows Azure services to connect. For production, consider using VNet integration with private endpoints instead.

### 4.2 Create the database

```bash
az postgres flexible-server db create \
  --resource-group $RESOURCE_GROUP \
  --server-name $DB_SERVER \
  --database-name $DB_NAME
```

### 4.3 Enable the pgvector extension

```bash
az postgres flexible-server parameter set \
  --resource-group $RESOURCE_GROUP \
  --server-name $DB_SERVER \
  --name azure.extensions \
  --value VECTOR
```

Connect to the database and run:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 4.4 Build the connection string

Your `DATABASE_URL` will be:
```
postgresql://<DB_ADMIN_USER>:<password>@<DB_SERVER>.postgres.database.azure.com/<DB_NAME>?sslmode=require
```

Example:
```
postgresql://matchpointadmin:MyPass123@matchpoint-db-server.postgres.database.azure.com/matchpointdb?sslmode=require
```

> **Important:** Azure PostgreSQL Flexible Server requires `sslmode=require` in all connection strings. The `pg` driver used by Drizzle supports this out of the box.

### 4.5 Allow App Service to connect (Firewall rule)

After the App Service is created, add its outbound IPs:

```bash
# Get the App Service outbound IPs
OUTBOUND_IPS=$(az webapp show \
  --resource-group $RESOURCE_GROUP \
  --name $APP_NAME \
  --query outboundIpAddresses \
  --output tsv)

# Add each IP to the PostgreSQL firewall
for IP in $(echo $OUTBOUND_IPS | tr ',' ' '); do
  az postgres flexible-server firewall-rule create \
    --resource-group $RESOURCE_GROUP \
    --name $DB_SERVER \
    --rule-name "allow-appservice-$IP" \
    --start-ip-address $IP \
    --end-ip-address $IP
done
```

---

## 5. Step 2 — Provision Azure App Service (API Server)

### 5.1 Create the App Service Plan

```bash
az appservice plan create \
  --resource-group $RESOURCE_GROUP \
  --name $APP_SERVICE_PLAN \
  --location $LOCATION \
  --sku B2 \
  --is-linux
```

> Use `P1v3` for production workloads that need consistent performance. `B2` is sufficient for staging or low-traffic environments.

### 5.2 Create the Web App

```bash
az webapp create \
  --resource-group $RESOURCE_GROUP \
  --plan $APP_SERVICE_PLAN \
  --name $APP_NAME \
  --runtime "NODE:24-lts" \
  --deployment-local-git
```

### 5.3 Configure the startup command

The API server builds to `artifacts/api-server/dist/index.mjs`. Tell App Service how to start it:

```bash
az webapp config set \
  --resource-group $RESOURCE_GROUP \
  --name $APP_NAME \
  --startup-file "node artifacts/api-server/dist/index.mjs"
```

### 5.4 Enable system-assigned managed identity

This allows the App Service to access Key Vault without storing credentials:

```bash
az webapp identity assign \
  --resource-group $RESOURCE_GROUP \
  --name $APP_NAME
```

Note the `principalId` from the output — you'll need it for Key Vault access.

---

## 6. Step 3 — Provision Azure Static Web Apps (Frontend)

Azure Static Web Apps (SWA) hosts the Vite-built React SPA with global CDN and automatic HTTPS.

### 6.1 Create the Static Web App

```bash
az staticwebapp create \
  --resource-group $RESOURCE_GROUP \
  --name $SWA_NAME \
  --location "eastus2" \
  --source "https://github.com/<your-org>/<your-repo>" \
  --branch "main" \
  --app-location "artifacts/resume-matcher" \
  --output-location "dist" \
  --login-with-github
```

> This creates the SWA and connects it to your GitHub repository. The `--login-with-github` flag opens a browser to authorise the connection. SWA will auto-deploy on every push to `main`.

### 6.2 Configure the SPA fallback route

Create `artifacts/resume-matcher/public/staticwebapp.config.json`:

```json
{
  "navigationFallback": {
    "rewrite": "/index.html",
    "exclude": ["/api/*", "*.{css,scss,js,png,gif,ico,jpg,svg}"]
  },
  "routes": [
    {
      "route": "/api/*",
      "allowedRoles": ["anonymous"]
    }
  ],
  "globalHeaders": {
    "Cache-Control": "no-store",
    "X-Frame-Options": "SAMEORIGIN",
    "X-Content-Type-Options": "nosniff"
  }
}
```

This ensures that navigating directly to `/tickets/1` or `/interviews` returns `index.html` rather than a 404.

### 6.3 Configure the API base URL in the frontend

The React app must know where the API lives. Set the Vite environment variable before building:

In `artifacts/resume-matcher/.env.production` (committed to the repo):
```
VITE_API_BASE_URL=https://matchpoint.yourdomain.com
```

The API calls in `enterprise-api.ts` should prepend this base URL. If not already done:

```typescript
// artifacts/resume-matcher/src/lib/enterprise-api.ts
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

// All fetch calls use API_BASE:
const response = await fetch(`${API_BASE}/api/enterprise/resumes`, { ... });
```

---

## 7. Step 4 — Configure Azure Key Vault for Secrets

### 7.1 Create the Key Vault

```bash
az keyvault create \
  --resource-group $RESOURCE_GROUP \
  --name $KEY_VAULT_NAME \
  --location $LOCATION \
  --sku standard \
  --enable-rbac-authorization true
```

### 7.2 Store secrets

```bash
# Database URL
az keyvault secret set \
  --vault-name $KEY_VAULT_NAME \
  --name "DATABASE-URL" \
  --value "postgresql://matchpointadmin:<password>@matchpoint-db-server.postgres.database.azure.com/matchpointdb?sslmode=require"

# Session secret
az keyvault secret set \
  --vault-name $KEY_VAULT_NAME \
  --name "SESSION-SECRET" \
  --value "<your-32-byte-hex-secret>"

# OpenAI API key
az keyvault secret set \
  --vault-name $KEY_VAULT_NAME \
  --name "OPENAI-API-KEY" \
  --value "<your-openai-api-key>"
```

### 7.3 Grant App Service access to Key Vault

```bash
# Get the App Service managed identity principal ID
PRINCIPAL_ID=$(az webapp identity show \
  --resource-group $RESOURCE_GROUP \
  --name $APP_NAME \
  --query principalId \
  --output tsv)

# Get the Key Vault resource ID
KV_ID=$(az keyvault show \
  --name $KEY_VAULT_NAME \
  --query id \
  --output tsv)

# Assign Key Vault Secrets User role
az role assignment create \
  --assignee $PRINCIPAL_ID \
  --role "Key Vault Secrets User" \
  --scope $KV_ID
```

---

## 8. Step 5 — Configure Application Settings (Environment Variables)

Set environment variables on the App Service. Use Key Vault references for sensitive values:

```bash
# Get Key Vault URI
KV_URI=$(az keyvault show \
  --name $KEY_VAULT_NAME \
  --query properties.vaultUri \
  --output tsv)

az webapp config appsettings set \
  --resource-group $RESOURCE_GROUP \
  --name $APP_NAME \
  --settings \
    DATABASE_URL="@Microsoft.KeyVault(SecretUri=${KV_URI}secrets/DATABASE-URL/)" \
    SESSION_SECRET="@Microsoft.KeyVault(SecretUri=${KV_URI}secrets/SESSION-SECRET/)" \
    OPENAI_API_KEY="@Microsoft.KeyVault(SecretUri=${KV_URI}secrets/OPENAI-API-KEY/)" \
    NODE_ENV="production" \
    PORT="8080"
```

> The `@Microsoft.KeyVault(...)` syntax tells App Service to retrieve the secret from Key Vault at runtime using the managed identity. The value is never stored in App Service settings — only the reference is.

### Verify settings resolve

```bash
az webapp config appsettings list \
  --resource-group $RESOURCE_GROUP \
  --name $APP_NAME \
  --output table
```

---

## 9. Step 6 — Push the Database Schema

After the database is provisioned, push the Drizzle schema to create all tables.

Run from your local machine (or in the CI/CD pipeline as a post-deploy step):

```bash
# Set the production database URL temporarily
export DATABASE_URL="postgresql://matchpointadmin:<password>@matchpoint-db-server.postgres.database.azure.com/matchpointdb?sslmode=require"

# Push the schema
pnpm --filter @workspace/db run push
```

This creates all 18 tables and enables the pgvector extension for the `resume_profiles` table.

> **Tip:** Include this as a step in your GitHub Actions workflow (see next section) so schema is always in sync after deployment.

---

## 10. Step 7 — Deploy via GitHub Actions (CI/CD)

### 10.1 Create the GitHub Actions workflow

Create `.github/workflows/deploy.yml` in your repository:

```yaml
name: Deploy MatchPoint Enterprise

on:
  push:
    branches: [main]
  workflow_dispatch:

env:
  NODE_VERSION: "24"
  PNPM_VERSION: "9"

jobs:
  # ─── Build & Test ───────────────────────────────────────────────────────
  build:
    name: Build
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: TypeScript type-check
        run: pnpm run typecheck

      - name: Build API server
        run: pnpm --filter @workspace/api-server run build

      - name: Build frontend
        run: pnpm --filter @workspace/resume-matcher run build
        env:
          VITE_API_BASE_URL: https://matchpoint.yourdomain.com

      - name: Upload API build artifact
        uses: actions/upload-artifact@v4
        with:
          name: api-dist
          path: artifacts/api-server/dist/

      - name: Upload frontend build artifact
        uses: actions/upload-artifact@v4
        with:
          name: frontend-dist
          path: artifacts/resume-matcher/dist/

  # ─── Deploy API to Azure App Service ────────────────────────────────────
  deploy-api:
    name: Deploy API
    runs-on: ubuntu-latest
    needs: build
    environment: production
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Download API build
        uses: actions/download-artifact@v4
        with:
          name: api-dist
          path: artifacts/api-server/dist/

      - name: Push database schema
        run: pnpm --filter @workspace/db run push
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}

      - name: Login to Azure
        uses: azure/login@v2
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}

      - name: Deploy to Azure App Service
        uses: azure/webapps-deploy@v3
        with:
          app-name: matchpoint-api
          package: .

  # ─── Deploy Frontend to Azure Static Web Apps ───────────────────────────
  deploy-frontend:
    name: Deploy Frontend
    runs-on: ubuntu-latest
    needs: build
    environment: production
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Download frontend build
        uses: actions/download-artifact@v4
        with:
          name: frontend-dist
          path: artifacts/resume-matcher/dist/

      - name: Deploy to Azure Static Web Apps
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
          repo_token: ${{ secrets.GITHUB_TOKEN }}
          action: upload
          app_location: artifacts/resume-matcher
          output_location: dist
          skip_app_build: true
```

### 10.2 Add GitHub Actions secrets

In your GitHub repository → Settings → Secrets and variables → Actions, add:

| Secret name | Value |
|---|---|
| `AZURE_CREDENTIALS` | JSON service principal (see below) |
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | From the SWA resource in Azure Portal |
| `DATABASE_URL` | Production PostgreSQL connection string |

### 10.3 Create the Azure service principal for GitHub Actions

```bash
az ad sp create-for-rbac \
  --name "matchpoint-github-actions" \
  --role contributor \
  --scopes /subscriptions/<subscription-id>/resourceGroups/$RESOURCE_GROUP \
  --json-auth
```

Copy the full JSON output and paste it as the `AZURE_CREDENTIALS` GitHub secret.

### 10.4 Get the Static Web Apps deployment token

```bash
az staticwebapp secrets list \
  --resource-group $RESOURCE_GROUP \
  --name $SWA_NAME \
  --query "properties.apiKey" \
  --output tsv
```

Paste this value as `AZURE_STATIC_WEB_APPS_API_TOKEN`.

---

## 11. Step 8 — Configure Path-Based Routing (Azure Front Door)

Azure Front Door routes `/api/*` to the App Service and everything else to the Static Web App.

### 11.1 Create the Front Door profile

```bash
az afd profile create \
  --resource-group $RESOURCE_GROUP \
  --profile-name $FRONT_DOOR_NAME \
  --sku Standard_AzureFrontDoor
```

### 11.2 Add the API origin group

```bash
az afd origin-group create \
  --resource-group $RESOURCE_GROUP \
  --profile-name $FRONT_DOOR_NAME \
  --origin-group-name "api-origin-group" \
  --probe-request-type GET \
  --probe-protocol Https \
  --probe-interval-in-seconds 30 \
  --probe-path "/api/health" \
  --sample-size 4 \
  --successful-samples-required 3

az afd origin create \
  --resource-group $RESOURCE_GROUP \
  --profile-name $FRONT_DOOR_NAME \
  --origin-group-name "api-origin-group" \
  --origin-name "api-server" \
  --host-name "${APP_NAME}.azurewebsites.net" \
  --origin-host-header "${APP_NAME}.azurewebsites.net" \
  --http-port 80 \
  --https-port 443 \
  --priority 1 \
  --weight 1000 \
  --enabled-state Enabled
```

### 11.3 Add the frontend origin group

```bash
az afd origin-group create \
  --resource-group $RESOURCE_GROUP \
  --profile-name $FRONT_DOOR_NAME \
  --origin-group-name "frontend-origin-group" \
  --probe-request-type GET \
  --probe-protocol Https \
  --probe-interval-in-seconds 60 \
  --probe-path "/" \
  --sample-size 4 \
  --successful-samples-required 3

# Get the SWA default hostname
SWA_HOST=$(az staticwebapp show \
  --resource-group $RESOURCE_GROUP \
  --name $SWA_NAME \
  --query defaultHostname \
  --output tsv)

az afd origin create \
  --resource-group $RESOURCE_GROUP \
  --profile-name $FRONT_DOOR_NAME \
  --origin-group-name "frontend-origin-group" \
  --origin-name "frontend-swa" \
  --host-name $SWA_HOST \
  --origin-host-header $SWA_HOST \
  --http-port 80 \
  --https-port 443 \
  --priority 1 \
  --weight 1000 \
  --enabled-state Enabled
```

### 11.4 Add the endpoint and routes

```bash
# Create the endpoint
az afd endpoint create \
  --resource-group $RESOURCE_GROUP \
  --profile-name $FRONT_DOOR_NAME \
  --endpoint-name "matchpoint-endpoint" \
  --enabled-state Enabled

# Route for API — matches /api/*
az afd route create \
  --resource-group $RESOURCE_GROUP \
  --profile-name $FRONT_DOOR_NAME \
  --endpoint-name "matchpoint-endpoint" \
  --route-name "api-route" \
  --origin-group "api-origin-group" \
  --patterns-to-match "/api/*" \
  --forwarding-protocol HttpsOnly \
  --https-redirect Enabled \
  --supported-protocols Https

# Route for frontend — matches everything else
az afd route create \
  --resource-group $RESOURCE_GROUP \
  --profile-name $FRONT_DOOR_NAME \
  --endpoint-name "matchpoint-endpoint" \
  --route-name "frontend-route" \
  --origin-group "frontend-origin-group" \
  --patterns-to-match "/*" \
  --forwarding-protocol HttpsOnly \
  --https-redirect Enabled \
  --supported-protocols Https
```

---

## 12. Step 9 — Custom Domain & TLS

### 12.1 Map your domain

In your DNS provider, add a CNAME record:
```
matchpoint.yourdomain.com  →  matchpoint-endpoint-<hash>.z01.azurefd.net
```

The Front Door endpoint hostname is shown in the Azure Portal under the Front Door resource → Endpoints.

### 12.2 Validate and bind the domain

```bash
az afd custom-domain create \
  --resource-group $RESOURCE_GROUP \
  --profile-name $FRONT_DOOR_NAME \
  --custom-domain-name "matchpoint-custom-domain" \
  --host-name "matchpoint.yourdomain.com" \
  --certificate-type ManagedCertificate \
  --minimum-tls-version TLS12
```

Azure Front Door will automatically provision and renew a free managed TLS certificate for the domain. Provisioning typically takes 5–10 minutes after DNS propagation.

### 12.3 Associate the domain with the endpoint

In the Azure Portal: Front Door → Endpoints → matchpoint-endpoint → Custom Domains → Add → select the domain you created.

---

## 13. Step 10 — Monitoring & Alerting

### 13.1 Enable Application Insights

```bash
az monitor app-insights component create \
  --resource-group $RESOURCE_GROUP \
  --app "matchpoint-insights" \
  --location $LOCATION \
  --kind web \
  --application-type web

# Get the instrumentation key
INSIGHTS_KEY=$(az monitor app-insights component show \
  --resource-group $RESOURCE_GROUP \
  --app "matchpoint-insights" \
  --query instrumentationKey \
  --output tsv)

# Add to App Service settings
az webapp config appsettings set \
  --resource-group $RESOURCE_GROUP \
  --name $APP_NAME \
  --settings APPLICATIONINSIGHTS_CONNECTION_STRING="InstrumentationKey=${INSIGHTS_KEY}"
```

### 13.2 Set up alerts

**High error rate alert:**
```bash
az monitor metrics alert create \
  --resource-group $RESOURCE_GROUP \
  --name "MatchPoint-HighErrorRate" \
  --scopes $(az webapp show --resource-group $RESOURCE_GROUP --name $APP_NAME --query id --output tsv) \
  --condition "avg Http5xx > 10" \
  --window-size 5m \
  --evaluation-frequency 1m \
  --severity 2 \
  --description "API server returning high number of 5xx errors"
```

**Database CPU alert:**
```bash
az monitor metrics alert create \
  --resource-group $RESOURCE_GROUP \
  --name "MatchPoint-DBHighCPU" \
  --scopes $(az postgres flexible-server show --resource-group $RESOURCE_GROUP --name $DB_SERVER --query id --output tsv) \
  --condition "avg cpu_percent > 80" \
  --window-size 5m \
  --evaluation-frequency 1m \
  --severity 2 \
  --description "PostgreSQL CPU usage over 80%"
```

### 13.3 Log streaming (real-time)

```bash
az webapp log tail \
  --resource-group $RESOURCE_GROUP \
  --name $APP_NAME
```

### 13.4 Enable App Service diagnostic logs

```bash
az webapp log config \
  --resource-group $RESOURCE_GROUP \
  --name $APP_NAME \
  --application-logging filesystem \
  --detailed-error-messages true \
  --failed-request-tracing true \
  --web-server-logging filesystem
```

---

## 14. Post-Deployment Verification

After completing all steps, verify the deployment end-to-end:

### API Health Check
```bash
curl https://matchpoint.yourdomain.com/api/health
# Expected: {"status":"ok"}
```

### Authentication
```bash
curl -X POST https://matchpoint.yourdomain.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Admin","email":"admin@test.com","password":"TestPass123","orgName":"Test Org"}'
# Expected: {"token":"<jwt>","user":{...}}
```

### Resume Analysis (AI Check)
1. Navigate to `https://matchpoint.yourdomain.com`
2. Paste a resume and job description
3. Click Analyze Match
4. Verify GPT-5.2 returns scores, strengths, and gaps

### Database Connectivity
1. Sign in and navigate to Candidates
2. Upload a PDF candidate
3. Verify the candidate appears in the list (confirms DB write + PDF parse)

### SPA Routing (Fallback Check)
1. Navigate directly to `https://matchpoint.yourdomain.com/interviews`
2. Reload the page
3. Verify the React app loads (not a 404 from the CDN)

### Interview Scheduling
1. Create a position ticket, schedule an interview
2. Download the `.ics` file — verify it opens in Outlook or Calendar

---

## 15. Cost Estimate

Monthly cost estimates (USD) for a production deployment — **East US region**:

| Service | Tier | Estimated Cost/month |
|---|---|---|
| Azure App Service | B2 Linux | ~$30 |
| Azure Static Web Apps | Standard | ~$9 |
| Azure Database for PostgreSQL | Burstable B2s, 32 GB | ~$30 |
| Azure Front Door | Standard (5 GB egress) | ~$35 |
| Azure Key Vault | Standard (~10K operations) | ~$1 |
| Azure Monitor / App Insights | 5 GB logs/month | ~$10 |
| **Total** | | **~$115/month** |

> Scale up App Service to **P1v3** (~$75/month) and PostgreSQL to **General Purpose D4s** (~$250/month) for high-traffic production workloads.

---

## 16. Security Checklist

| Item | How to verify |
|---|---|
| TLS enforced on all endpoints | All HTTP redirects to HTTPS via Front Door |
| Secrets in Key Vault only | App Service settings show `@Microsoft.KeyVault(...)` references |
| Managed identity — no stored credentials | App Service identity assigned; no passwords in settings |
| PostgreSQL SSL required | `sslmode=require` in DATABASE_URL |
| PostgreSQL not publicly accessible | Firewall allows App Service IPs only |
| App Service plan is Linux | Confirmed in `az appservice plan show` output |
| WAF enabled on Front Door | Enable Azure Front Door WAF policy (Standard tier) |
| CORS restricted to your domain | Add CORS settings to App Service via `az webapp cors add` |
| Node.js 24 runtime | Confirmed via `az webapp show --query siteConfig.linuxFxVersion` |
| JWT secret ≥32 bytes | Confirmed when secret was generated |
| bcrypt password hashing | Built into API server (cost factor 10) |
| Webhook HMAC signatures | Built into webhook engine |
| Audit log immutable | Append-only table — no DELETE routes |

### Add CORS to restrict to your domain

```bash
az webapp cors add \
  --resource-group $RESOURCE_GROUP \
  --name $APP_NAME \
  --allowed-origins "https://matchpoint.yourdomain.com"
```

---

## 17. Troubleshooting

### App Service fails to start

**Symptom:** 503 errors immediately after deployment.

**Check:**
```bash
az webapp log tail --resource-group $RESOURCE_GROUP --name $APP_NAME
```

Common causes:
- `PORT` environment variable not set — ensure it is set to `8080`
- `DATABASE_URL` Key Vault reference not resolving — verify managed identity has `Key Vault Secrets User` role
- Startup command incorrect — verify it reads `node artifacts/api-server/dist/index.mjs`

### Database connection refused

**Symptom:** API starts but returns 500 on any data endpoint.

**Check:**
- The App Service outbound IPs are whitelisted in the PostgreSQL firewall
- `sslmode=require` is in the connection string
- Database server name is correct (`.postgres.database.azure.com` suffix required)

Run from the App Service console (Portal → App Service → Console):
```bash
node -e "const { Client } = require('pg'); const c = new Client({ connectionString: process.env.DATABASE_URL }); c.connect().then(() => console.log('Connected')).catch(e => console.error(e))"
```

### OpenAI API key not working

**Symptom:** Resume analysis returns 500 or "AI service unavailable".

**Check:**
- Key Vault secret `OPENAI-API-KEY` is set and the correct value
- App Service identity has `Key Vault Secrets User` role
- Restart the App Service after changing settings: `az webapp restart --resource-group $RESOURCE_GROUP --name $APP_NAME`

### SPA returns 404 on page reload

**Symptom:** Reloading `/interviews` or `/tickets/1` returns 404.

**Fix:** Verify `staticwebapp.config.json` exists in `artifacts/resume-matcher/public/` with the `navigationFallback` rule pointing to `/index.html`.

### Front Door returns old cached content

**Symptom:** After deploying, the old version of the frontend still appears.

**Fix:** Purge the Front Door cache:
```bash
az afd endpoint purge \
  --resource-group $RESOURCE_GROUP \
  --profile-name $FRONT_DOOR_NAME \
  --endpoint-name "matchpoint-endpoint" \
  --content-paths "/*"
```

### pgvector extension missing

**Symptom:** DB error `type "vector" does not exist`.

**Fix:**
```bash
az postgres flexible-server parameter set \
  --resource-group $RESOURCE_GROUP \
  --server-name $DB_SERVER \
  --name azure.extensions \
  --value VECTOR

# Then connect and run:
psql $DATABASE_URL -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

---

## Appendix A — Useful Azure CLI Commands

```bash
# View App Service logs
az webapp log tail --resource-group $RESOURCE_GROUP --name $APP_NAME

# Restart the App Service
az webapp restart --resource-group $RESOURCE_GROUP --name $APP_NAME

# View current environment variables
az webapp config appsettings list --resource-group $RESOURCE_GROUP --name $APP_NAME --output table

# SSH into the App Service container
az webapp ssh --resource-group $RESOURCE_GROUP --name $APP_NAME

# Scale up App Service plan
az appservice plan update --resource-group $RESOURCE_GROUP --name $APP_SERVICE_PLAN --sku P1v3

# Get Front Door endpoint hostname
az afd endpoint show --resource-group $RESOURCE_GROUP --profile-name $FRONT_DOOR_NAME --endpoint-name matchpoint-endpoint --query hostName --output tsv

# Backup PostgreSQL
az postgres flexible-server backup create --resource-group $RESOURCE_GROUP --name $DB_SERVER --backup-name "manual-backup-$(date +%Y%m%d)"
```

## Appendix B — Environment Summary

| Variable | Source in Azure |
|---|---|
| `DATABASE_URL` | Key Vault reference in App Service settings |
| `SESSION_SECRET` | Key Vault reference in App Service settings |
| `OPENAI_API_KEY` | Key Vault reference in App Service settings |
| `PORT` | Set directly in App Service settings (value: `8080`) |
| `NODE_ENV` | Set directly in App Service settings (value: `production`) |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | Set directly in App Service settings |

---

*MatchPoint Enterprise — Azure Deployment Guide*
*Azure App Service · Azure Static Web Apps · Azure Database for PostgreSQL · Azure Front Door · Azure Key Vault*
