# MatchPoint Enterprise — n8n & AI Engine on Azure
**Supplement to the Minimal Azure Deployment Guide**

---

## Overview

Two things need attention when moving off Replit to Azure:

| Component | On Replit | On Azure |
|---|---|---|
| **AI engine** | Replit proxy injects the API key and base URL automatically | You must point the client at a real OpenAI-compatible endpoint and swap the model name |
| **n8n** | Not hosted — you connect to your own n8n | Same: host n8n yourself or use n8n Cloud, then update webhook URLs |

Both are straightforward. This guide covers the exact env-var changes and the two hosting options for each.

---

## Part 1 — AI Engine

### How it works in the codebase

Every AI call in the API server imports from the shared OpenAI client:

```typescript
// All routes (resume.ts, bulkJobs.ts, agentShortlist.ts, rag.ts, etc.)
import { openai } from "@workspace/integrations-openai-ai-server";
```

That client reads two environment variables at startup:

```typescript
// lib/integrations-openai-ai-server/src/client.ts
export const openai = new OpenAI({
  apiKey:  process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});
```

On Replit these are injected automatically. On Azure you set them yourself.

The current model used across all routes: **`gpt-5.2`** (Replit-specific model name). This must be changed to whichever model you deploy on your chosen endpoint.

---

### Option A — Direct OpenAI API (simplest)

No infrastructure. Just an OpenAI account and API key.

**Cost:** Pay-per-token — typical usage ~$20–80/month depending on analysis volume.

**Step 1: Set the environment variables on App Service**

```bash
az webapp config appsettings set \
  --resource-group matchpoint-rg \
  --name matchpoint-app \
  --settings \
    AI_INTEGRATIONS_OPENAI_API_KEY="sk-..." \
    AI_INTEGRATIONS_OPENAI_BASE_URL="https://api.openai.com/v1"
```

**Step 2: Change the model name**

`gpt-5.2` is a Replit-only model name. Replace it with `gpt-4o` (best available on direct OpenAI) in every route file.

Files to update — find all occurrences:

```bash
grep -rn "gpt-5.2" artifacts/api-server/src/
```

Replace every instance of:
```typescript
model: "gpt-5.2",
```
with:
```typescript
model: "gpt-4o",
```

Affected files:
- `artifacts/api-server/src/routes/resume.ts`
- `artifacts/api-server/src/routes/bulkJobs.ts`
- `artifacts/api-server/src/routes/agentShortlist.ts`
- `artifacts/api-server/src/routes/rag.ts`

The embeddings model (`text-embedding-3-small`) is already a standard OpenAI name — no change needed.

**Step 3: Rebuild and redeploy**

```bash
pnpm --filter @workspace/api-server run build
# then redeploy as per the minimal deployment guide
```

---

### Option B — Azure OpenAI Service (enterprise, data stays in Azure)

Use this if your organisation requires data residency in Azure or has compliance requirements (GDPR, HIPAA). All AI calls stay within your Azure tenant.

**Cost:** Same pay-per-token pricing as OpenAI, billed through your Azure subscription.

**Step 1: Request access to Azure OpenAI**

Go to: https://aka.ms/oai/access and complete the access request form. Approval typically takes 1–3 business days.

**Step 2: Create the Azure OpenAI resource**

```bash
az cognitiveservices account create \
  --resource-group matchpoint-rg \
  --name matchpoint-openai \
  --location eastus \
  --kind OpenAI \
  --sku S0 \
  --custom-domain matchpoint-openai
```

**Step 3: Deploy the models**

Deploy both models your app uses:

```bash
# Chat completion model
az cognitiveservices account deployment create \
  --resource-group matchpoint-rg \
  --name matchpoint-openai \
  --deployment-name "gpt-4o" \
  --model-name gpt-4o \
  --model-version "2024-11-20" \
  --model-format OpenAI \
  --sku-capacity 50 \
  --sku-name Standard

# Embeddings model
az cognitiveservices account deployment create \
  --resource-group matchpoint-rg \
  --name matchpoint-openai \
  --deployment-name "text-embedding-3-small" \
  --model-name text-embedding-3-small \
  --model-version "1" \
  --model-format OpenAI \
  --sku-capacity 50 \
  --sku-name Standard
```

**Step 4: Get your endpoint and key**

```bash
# Endpoint
az cognitiveservices account show \
  --resource-group matchpoint-rg \
  --name matchpoint-openai \
  --query properties.endpoint \
  --output tsv
# Example: https://matchpoint-openai.openai.azure.com/

# API Key
az cognitiveservices account keys list \
  --resource-group matchpoint-rg \
  --name matchpoint-openai \
  --query key1 \
  --output tsv
```

**Step 5: Update the OpenAI client to use Azure**

Replace `lib/integrations-openai-ai-server/src/client.ts`:

```typescript
import { AzureOpenAI } from "openai";

if (!process.env.AI_INTEGRATIONS_OPENAI_BASE_URL) {
  throw new Error("AI_INTEGRATIONS_OPENAI_BASE_URL must be set (Azure OpenAI endpoint)");
}
if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
  throw new Error("AI_INTEGRATIONS_OPENAI_API_KEY must be set");
}

export const openai = new AzureOpenAI({
  apiKey:     process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  endpoint:   process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiVersion: "2025-01-01-preview",
});
```

**Step 6: Change the model names to deployment names**

In every route file, the `model` field must match your **deployment name** (not the OpenAI model name):

```typescript
// Before
model: "gpt-5.2",

// After (must match the deployment-name you set in Step 3)
model: "gpt-4o",
```

The embeddings model is already named `"text-embedding-3-small"` — this matches the deployment name if you used the same name in Step 3.

**Step 7: Set env vars on App Service**

```bash
az webapp config appsettings set \
  --resource-group matchpoint-rg \
  --name matchpoint-app \
  --settings \
    AI_INTEGRATIONS_OPENAI_API_KEY="<azure-openai-key>" \
    AI_INTEGRATIONS_OPENAI_BASE_URL="https://matchpoint-openai.openai.azure.com/"
```

**Step 8: Rebuild and redeploy**

```bash
pnpm --filter @workspace/api-server run build
# redeploy
```

---

### AI Option Comparison

| | Option A: Direct OpenAI | Option B: Azure OpenAI |
|---|---|---|
| Setup time | 5 minutes | 1–3 days (access approval) |
| Data residency | OpenAI data centres | Your Azure region |
| Compliance | Standard OpenAI DPA | Azure enterprise agreements, GDPR, HIPAA |
| Model availability | Immediate, all models | Requires deployment, regional availability |
| Cost | Same token pricing | Same token pricing via Azure billing |
| Code change | Model name only | Client class + model name |
| Recommended for | Getting started quickly | Enterprise / regulated industries |

---

## Part 2 — n8n

n8n is the workflow automation tool that receives webhook events from MatchPoint Enterprise (interview scheduled, shortlist approved, etc.) and triggers actions like Teams notifications, Outlook calendar invites, and Gmail outreach.

It is not part of the MatchPoint codebase — it is a separate service you run alongside it. There is no code change required in MatchPoint to switch n8n hosting — only the webhook URL in the Integrations settings page changes.

---

### Option A — n8n Cloud (recommended, zero infra)

The easiest path. n8n manages the server, updates, and uptime.

**Cost:** $24/month (Starter — 5 active workflows, 2500 executions/month)

**Steps:**

1. Go to https://n8n.io and sign up for the Starter plan
2. Your n8n instance is at `https://your-name.app.n8n.cloud`
3. Import the MatchPoint workflow templates:
   - In n8n: **Workflows → Import from file**
   - Upload each JSON file from `docs/n8n/` in the MatchPoint repo
4. In each workflow, update the credential fields (Teams channel ID, Outlook account, etc.)
5. Create a **Header Auth** credential named `MatchPoint Webhook Secret`:
   - Header name: `X-MatchPoint-Signature`
   - Header value: your webhook secret
6. Copy your n8n webhook trigger URL (shown in the webhook node of each workflow)
7. In MatchPoint → Integrations: paste the webhook URL and save

That's it. When MatchPoint fires a webhook event, n8n receives it and runs the workflow.

---

### Option B — Self-hosted on Azure Container Instances (cheapest Azure option)

Run n8n in a single Azure container. No Kubernetes, no App Service — just a container that runs continuously.

**Cost:** ~$15/month (1 vCPU, 1.5 GB RAM, persistent storage)

**Step 1: Create a storage account for n8n data persistence**

```bash
az storage account create \
  --resource-group matchpoint-rg \
  --name matchpointn8nstorage \
  --location eastus \
  --sku Standard_LRS

az storage share create \
  --account-name matchpointn8nstorage \
  --name n8n-data \
  --quota 5
```

Get the storage key:
```bash
STORAGE_KEY=$(az storage account keys list \
  --resource-group matchpoint-rg \
  --account-name matchpointn8nstorage \
  --query "[0].value" \
  --output tsv)
```

**Step 2: Deploy the n8n container**

```bash
az container create \
  --resource-group matchpoint-rg \
  --name matchpoint-n8n \
  --image n8nio/n8n:latest \
  --cpu 1 \
  --memory 1.5 \
  --ports 5678 \
  --protocol TCP \
  --ip-address Public \
  --dns-name-label matchpoint-n8n \
  --environment-variables \
    N8N_BASIC_AUTH_ACTIVE=true \
    N8N_BASIC_AUTH_USER=admin \
    N8N_BASIC_AUTH_PASSWORD="<strong-password>" \
    WEBHOOK_URL="http://matchpoint-n8n.eastus.azurecontainer.io:5678/" \
    GENERIC_TIMEZONE="UTC" \
    N8N_ENCRYPTION_KEY="<32-char-random-string>" \
  --azure-file-volume-account-name matchpointn8nstorage \
  --azure-file-volume-account-key $STORAGE_KEY \
  --azure-file-volume-share-name n8n-data \
  --azure-file-volume-mount-path /home/node/.n8n
```

Generate a random encryption key:
```bash
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

**Step 3: Access n8n**

Your n8n instance is at:
```
http://matchpoint-n8n.eastus.azurecontainer.io:5678
```

Sign in with the `admin` username and password you set above.

**Step 4: Add HTTPS (optional but recommended)**

Azure Container Instances does not provide TLS termination. For HTTPS on n8n, either:

- Put an **Azure Application Gateway** in front (adds ~$20/month), or
- Use **n8n Cloud** instead (Option A) which includes HTTPS automatically.

For internal-only use or testing, plain HTTP on port 5678 is fine.

**Step 5: Import MatchPoint templates and configure**

Same as n8n Cloud:
1. **Workflows → Import from file** — upload each JSON from `docs/n8n/`
2. Update credential fields in each workflow
3. Copy the webhook trigger URL from each workflow
4. In MatchPoint → Integrations: paste the URL

**Step 6: Set the webhook URL in your workflows**

In each n8n workflow's Webhook node, set the path. Your webhook base URL is:
```
http://matchpoint-n8n.eastus.azurecontainer.io:5678/webhook/
```

---

### Option C — Azure Container Apps (more scalable)

If you expect high n8n execution volume or want auto-scaling:

```bash
# Create Container Apps environment
az containerapp env create \
  --resource-group matchpoint-rg \
  --name matchpoint-n8n-env \
  --location eastus

# Deploy n8n
az containerapp create \
  --resource-group matchpoint-rg \
  --name matchpoint-n8n \
  --environment matchpoint-n8n-env \
  --image n8nio/n8n:latest \
  --target-port 5678 \
  --ingress external \
  --min-replicas 1 \
  --max-replicas 3 \
  --env-vars \
    N8N_BASIC_AUTH_ACTIVE=true \
    N8N_BASIC_AUTH_USER=admin \
    N8N_BASIC_AUTH_PASSWORD="<strong-password>" \
    N8N_ENCRYPTION_KEY="<32-char-random-string>" \
    GENERIC_TIMEZONE="UTC"
```

Container Apps provides automatic HTTPS with a `.azurecontainerapps.io` domain and scales to zero when idle.

**Cost:** ~$0–25/month depending on executions (scales to near-zero when idle).

---

### n8n Option Comparison

| | Option A: n8n Cloud | Option B: Azure Container Instances | Option C: Azure Container Apps |
|---|---|---|---|
| Cost/month | $24 | ~$15 | ~$5–25 |
| HTTPS | Included | Manual (App Gateway) | Included |
| Setup time | 5 minutes | 20 minutes | 30 minutes |
| Data residency | n8n servers | Your Azure region | Your Azure region |
| Updates | Automatic | Manual (`docker pull`) | Manual image update |
| Persistence | Managed | Azure File Share | Needs volume config |
| Recommended for | Getting started, simplicity | Cost-sensitive, control | High execution volume |

---

## Updated Total Cost (Minimal Azure + n8n + AI)

| Component | Service | Cost/month |
|---|---|---|
| API + Frontend | Azure App Service B1 | ~$13 |
| Database | Azure PostgreSQL B1ms | ~$12 |
| AI | OpenAI API (direct) | ~$20–80 |
| n8n | n8n Cloud Starter | $24 |
| **Total** | | **~$70–130** |

Or with fully self-hosted n8n (Container Instances):

| Component | Service | Cost/month |
|---|---|---|
| API + Frontend | Azure App Service B1 | ~$13 |
| Database | Azure PostgreSQL B1ms | ~$12 |
| AI | OpenAI API (direct) | ~$20–80 |
| n8n | Azure Container Instances | ~$15 |
| **Total** | | **~$60–120** |

---

## Quick Decision Guide

```
Are you in a regulated industry (finance, healthcare, government)?
  YES → Use Azure OpenAI Service (Option B for AI)
  NO  → Use Direct OpenAI API (Option A for AI, 5-minute setup)

Do you want zero infrastructure to manage for n8n?
  YES → Use n8n Cloud ($24/month)
  NO  → Use Azure Container Instances (~$15/month, stays in your Azure tenant)
```

---

## Connecting it all — End-to-End Flow

Once deployed:

```
Recruiter schedules interview in MatchPoint
    │
    ▼
MatchPoint API fires webhook:
POST https://your-n8n.../webhook/interview-scheduled
{
  "event": "interview.scheduled",
  "payload": { "candidateName": "...", "scheduledAt": "...", ... }
}
    │
    ▼
n8n receives the webhook → runs "Teams Interview Notification" workflow
    │
    ▼
Teams channel receives Adaptive Card with interview details
+ Outlook Calendar invite created for all interviewers (via MS Graph)
```

No change to the MatchPoint codebase. Only the webhook URL in Integrations settings needs updating to point to your Azure-hosted or Cloud n8n instance.
