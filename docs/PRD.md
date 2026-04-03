# MatchPoint Enterprise — Product Requirements Document

**Version**: 2.0  
**Last Updated**: April 2026  
**Status**: Living Document

---

## 1. Vision

MatchPoint Enterprise is an AI-powered **end-to-end talent intelligence and recruiter operations platform**. It spans the full recruiting lifecycle: from sourcing and AI screening, through structured interviews and offer management, to onboarding handoff — with deep integrations into the communication tools and HR systems recruiters already use every day.

---

## 2. Current State (Phases 1–4 — Shipped)

| Capability | Status |
|---|---|
| Multi-tenant auth / RBAC (5 roles) | ✅ Live |
| Resume pool (PDF/text upload, auto-chunking) | ✅ Live |
| Job description management | ✅ Live |
| Bulk AI analysis (GPT-5.2) | ✅ Live |
| Audit log | ✅ Live |
| TF-IDF talent pool search | ✅ Live |
| Skills gap analytics + score charts | ✅ Live |
| AI agent shortlisting pipeline (human-in-the-loop) | ✅ Live |
| RAG search (BM25 + GPT-5.2, cited answers) | ✅ Live |
| Phase 5 — n8n Integration Hub | ✅ Live |
| → Webhook engine (HMAC-SHA256, 3-attempt retry) | ✅ Live |
| → 7 platform events instrumented | ✅ Live |
| → Per-tenant event filtering | ✅ Live |
| → Integrations settings UI + delivery log | ✅ Live |
| → n8n workflow templates (Gmail, Teams, Outlook) | ✅ Live |
| Phase 7 — HR Ticketing System | ✅ Live |
| → 7-column Kanban board with drag-and-drop | ✅ Live |
| → SLA engine (per-priority deadlines + breach alerts) | ✅ Live |
| → Ticket detail (activity feed, candidate pipeline) | ✅ Live |
| → Recruiter workload view | ✅ Live |

---

## 3. Roadmap Overview

```
Phase 5  →  n8n Integration Hub (Webhooks, Gmail, Outlook, Teams)
Phase 6  →  HR Systems Integration (HRIS, ATS, Payroll)
Phase 7  →  HR Ticketing System (Position tracking, recruiter workload)
Phase 8  →  Full Recruiter Portal (Interviews, offers, onboarding)
Phase 9  →  Analytics Command Centre (BI dashboards, forecasting)
```

---

## 4. Phase 5 — n8n Integration Hub

**Goal**: Connect MatchPoint to the communication tools recruiters live in, without building individual OAuth connectors for every provider.

### 4.1 Architecture

n8n acts as the **integration middleware**. MatchPoint emits structured webhook events; n8n workflows respond by sending emails, posting Teams/Slack messages, updating calendars, or calling back into the MatchPoint API.

```
MatchPoint → Webhook Event → n8n Workflow Engine
                                     ↓         ↓         ↓
                                  Gmail    Outlook   MS Teams
                                  Slack    Calendar  HR System
```

### 4.2 MatchPoint Webhook Events (new)

| Event | Triggered When |
|---|---|
| `candidate.uploaded` | Resume added to pool |
| `shortlist.pending_approval` | AI agent completes shortlist |
| `shortlist.approved` | HR approves a shortlist |
| `shortlist.rejected` | HR rejects a shortlist |
| `candidate.contacted` | Outreach email sent |
| `interview.scheduled` | Interview slot confirmed |
| `offer.extended` | Offer letter generated |
| `position.opened` | New ticket/position created |
| `position.closed` | Position filled or cancelled |

### 4.3 Outbound Integrations (via n8n)

**Gmail / Outlook**
- Automated candidate outreach email on shortlist approval
- Interview invitation with calendar attachment (.ics)
- Rejection email templates (personalised by AI)
- Recruiter digest: daily summary of pipeline status

**Microsoft Teams / Slack**
- Post to HR channel when shortlist is ready for approval
- DM the hiring manager when their position has new candidates
- Notify recruiter when a candidate replies to outreach
- Approval requests as interactive cards (approve/reject from Teams)

**Calendar (Google Calendar / Microsoft 365)**
- Auto-create interview slots when candidate confirms availability
- Block recruiter calendar during high-priority shortlist reviews
- Send .ics invites to all interview panel members

### 4.4 n8n Setup Options
- **Cloud**: Connect to n8n.cloud via API key
- **Self-hosted**: Deploy n8n alongside MatchPoint (Docker compose or Replit)
- MatchPoint stores the n8n webhook URL and API key per tenant in settings

### 4.5 New MatchPoint UI: Integrations Settings Page
- Tenant admin configures n8n endpoint + API key
- Toggle which events trigger notifications
- View webhook delivery log (last 50 events, status, retry)
- Test button per event type

### 4.6 Acceptance Criteria
- [ ] Webhook delivery service with retry logic (3 attempts, exponential backoff)
- [ ] `webhook_deliveries` table (event, payload, status, attempts, last_error)
- [ ] Integrations settings page in tenant admin
- [ ] n8n template workflows for Gmail outreach + Teams approval cards
- [ ] MatchPoint API: `POST /enterprise/webhooks/test/:event`

---

## 5. Phase 6 — HR Systems Integration

**Goal**: MatchPoint becomes the intelligence layer on top of the HR systems companies already use, rather than replacing them.

### 5.1 Supported Systems (via n8n or direct API)

| System | Integration Type | Data Flows |
|---|---|---|
| **BambooHR** | REST API (direct or n8n) | Import employees as Internal candidates; sync org chart |
| **Workday** | SOAP/REST (via n8n) | Import headcount plan; push hired candidates |
| **SAP SuccessFactors** | OData API (via n8n) | Sync positions, pull employee skills profiles |
| **Greenhouse / Lever** | REST API (direct) | Pull active job reqs; push AI-analysed candidates |
| **Rippling / Gusto** | REST API | Import onboarding status; trigger offer letters |

### 5.2 Sync Capabilities

**Inbound (HR System → MatchPoint)**
- Import all active employees as Internal candidates (with skills profile)
- Sync open positions as job descriptions (auto-create JDs)
- Pull approved headcount requests as position tickets (Phase 7)

**Outbound (MatchPoint → HR System)**
- Push shortlisted candidates to ATS pipeline
- Update hire status when offer is accepted
- Trigger onboarding workflow in HRIS on hire

### 5.3 Data Model Additions
- `integrations` table: tenant_id, provider, credentials_encrypted, sync_status, last_synced_at
- `sync_log` table: integration_id, direction, records_processed, errors, run_at
- `external_ids` table: entity_type, entity_id, provider, external_id (for dedup)

### 5.4 New UI: HR Systems Hub
- Connect/disconnect integrations with OAuth or API key
- Manual or scheduled sync (hourly/daily)
- Sync status dashboard with field-level mapping preview
- Error log with actionable messages

### 5.5 Acceptance Criteria
- [ ] At least 2 integrations working end-to-end (suggested: BambooHR + Greenhouse)
- [ ] Encrypted credential storage per tenant
- [ ] Sync log with drill-down per run
- [ ] Conflict resolution strategy documented (MatchPoint wins vs HR system wins)
- [ ] Webhook from HR system triggers MatchPoint re-analysis on position change

---

## 6. Phase 7 — HR Ticketing System

**Goal**: Give HR and recruiters a structured way to track every open position, from approval to hire, with workload visibility and SLA enforcement.

### 6.1 Core Concepts

- **Position Ticket**: A request to hire for a specific role. Links to a JD, has a status lifecycle, and is assigned to one or more recruiters.
- **Activity Feed**: Every action on a ticket is logged — status changes, comments, file uploads, AI results — similar to a Jira issue.
- **Recruiter Workload**: HR admins see load distribution across recruiters (open tickets per person, avg time-to-fill, overdue positions).

### 6.2 Ticket Lifecycle

```
Draft → Open → Sourcing → Screening → Interviewing → Offer → Closed (Filled / Cancelled)
```

Each transition can trigger:
- n8n notification to stakeholders
- Auto-run of AI agent shortlisting (Sourcing → Screening)
- Calendar invitation for interview panel (Interviewing)
- Offer letter draft generation (Offer)

### 6.3 Ticket Fields

| Field | Type | Notes |
|---|---|---|
| Title | text | e.g. "Senior React Engineer – Platform Team" |
| Job Description | FK → job_descriptions | Links AI analysis |
| Status | enum | See lifecycle above |
| Priority | enum | Critical / High / Medium / Low |
| Assigned Recruiter(s) | FK → users | Multi-assign supported |
| Hiring Manager | FK → users | Notification target |
| Target Start Date | date | SLA anchor |
| Budget / Salary Range | text | Optional |
| Number of Openings | int | Headcount |
| Filled Count | int | Auto-increments on hire |
| Tags | text[] | Department, location, remote |
| Comments | one-to-many | With @mentions and file attachments |
| AI Shortlists | one-to-many | FK → shortlist_jobs |
| Candidates | many-to-many | With per-ticket stage tracking |

### 6.4 SLA & Alerts
- Configurable SLA per priority level (e.g. Critical = 14 days to hire)
- Automated alerts at 50%, 80%, 100% of SLA window
- Daily digest to HR admin showing overdue positions
- SLA performance chart in Analytics

### 6.5 New DB Tables
```
position_tickets (id, tenant_id, title, jd_id, status, priority, assigned_to[], hiring_manager_id, target_start_date, openings, filled, tags[], created_at, updated_at)
ticket_comments (id, ticket_id, user_id, content, attachments[], created_at)
ticket_candidates (id, ticket_id, resume_profile_id, stage, updated_at)
ticket_history (id, ticket_id, user_id, field, old_value, new_value, changed_at)
```

### 6.6 New UI Pages
- **Position Board**: Kanban view of all tickets by status (drag to move)
- **Position Detail**: Full ticket view with activity feed, linked candidates, AI results
- **Recruiter Workload**: Table/chart of open tickets per recruiter with SLA indicators
- **My Queue**: Recruiter's personal view of assigned tickets, sorted by SLA urgency

### 6.7 Acceptance Criteria
- [ ] Full CRUD for position tickets with status transitions
- [ ] Kanban board with drag-and-drop reordering
- [ ] Activity feed with real-time updates (polling or WebSocket)
- [ ] @mention notifications via n8n (Phase 5 dependency)
- [ ] SLA calculation and alert engine
- [ ] Recruiter workload dashboard
- [ ] Position ticket links to JD, AI shortlist, and candidate pipeline
- [ ] CSV export of all tickets for a given period

---

## 7. Phase 8 — Full Recruiter Portal

**Goal**: Close the loop from candidate sourcing all the way to accepted offer and onboarding handoff, entirely within MatchPoint.

### 7.1 Interview Management
- **Interview templates**: Define panel structure, question sets, time per round
- **Scheduling**: AI suggests available slots based on panel calendars (via Microsoft 365 / Google Calendar API)
- **Scorecards**: Each interviewer submits a structured scorecard; AI aggregates consensus
- **Debrief**: One-click debrief summary generated by GPT-5.2 from all scorecards

### 7.2 Offer Management
- AI-assisted offer letter drafting (role, comp, start date, benefits pulled from ticket)
- Approval workflow: Recruiter drafts → HR Admin approves → Sent via DocuSign / PDF
- Counter-offer tracking with version history
- Offer acceptance triggers HRIS onboarding flow (Phase 6)

### 7.3 Candidate Portal (external-facing)
- Personalised candidate status page (magic link, no login required)
- Candidate self-schedules interview from available slots
- Upload additional documents (references, portfolio)
- Accept/decline offer digitally

### 7.4 Onboarding Handoff
- On offer acceptance, auto-create onboarding checklist
- Assign IT, HR, and manager tasks
- Day-1 readiness dashboard (laptop provisioning, access requests, buddy assignment)
- Trigger sync to HRIS (Phase 6)

### 7.5 Acceptance Criteria
- [ ] Interview scheduling with calendar sync (at least Google Calendar)
- [ ] Scorecard submission and AI debrief generation
- [ ] AI offer letter draft with approval workflow
- [ ] Candidate portal with magic link authentication
- [ ] Onboarding checklist with task assignment
- [ ] Full candidate journey visible in one timeline view

---

## 8. Phase 9 — Analytics Command Centre

**Goal**: Give leadership a real-time view of recruiting health, pipeline efficiency, and talent market intelligence.

### 8.1 Dashboards

**Recruiting Funnel**
- Candidates added → Screened → Shortlisted → Interviewed → Offered → Hired
- Conversion rates at each stage, by JD, by recruiter, by source

**Time & Efficiency**
- Average time-to-fill by role level, department, priority
- Average time-in-stage (where candidates spend longest)
- Recruiter throughput (candidates processed per week)

**Quality Metrics**
- Offer acceptance rate
- 90-day retention rate (integrated with HRIS)
- Interview-to-offer ratio
- AI shortlist accuracy (how many AI-shortlisted candidates were eventually hired)

**Talent Market Intelligence**
- Skills demand trends from all JDs created
- Skills supply from candidate pool
- Gap heatmap: which skills are being searched but rarely found
- Salary benchmark (if compensation data is entered)

**SLA Performance** (requires Phase 7)
- % positions filled within SLA
- At-risk positions by SLA breach date
- Historical SLA trend by priority level

### 8.2 Exports & Scheduling
- PDF/CSV export of any dashboard
- Scheduled email reports (weekly/monthly) via n8n (Phase 5)
- API access to analytics for custom BI tools (Power BI, Looker, Tableau)

### 8.3 Acceptance Criteria
- [ ] 5+ dashboards with real data from all previous phases
- [ ] Date range filtering on all charts
- [ ] Breakdown by recruiter, department, location
- [ ] Scheduled PDF report delivery
- [ ] REST API for analytics data

---

## 9. Technical Architecture Decisions

### Integration Strategy
| Approach | When to Use |
|---|---|
| n8n (Phase 5) | Communication tools: Gmail, Outlook, Teams, Slack, Calendar |
| Direct REST API | Simpler HR systems with good APIs (BambooHR, Greenhouse) |
| n8n with custom node | Complex enterprise systems: Workday, SAP, Oracle |

### Data Privacy & Security
- All integration credentials encrypted at rest (AES-256 via env-managed keys)
- Candidate data never sent to n8n — only event metadata and IDs
- n8n calls back to MatchPoint API using a per-tenant secret to fetch needed data
- Audit log entries for every external data sync

### Scalability Considerations
- Phase 5–6: Background job queue (Bull/BullMQ with Redis) replaces current `setTimeout` approach
- Phase 7+: Real-time updates via Server-Sent Events or WebSocket
- Phase 8+: Separate read DB replica for analytics queries

---

## 10. Priority Matrix

| Phase | Impact | Effort | Dependencies | Recommended Order |
|---|---|---|---|---|
| 5 — n8n / Comms | High | Medium | None | **Next** |
| 6 — HR Systems | High | High | Phase 5 (n8n) | 2nd |
| 7 — Ticketing | Very High | High | Phase 5 | 3rd |
| 8 — Recruiter Portal | Very High | Very High | Phases 6, 7 | 4th |
| 9 — Analytics | Medium | Medium | All phases | Parallel with 8 |

---

## 11. Phase 5 — Detailed Milestone Plan

*Ready to implement next.*

### Milestone 5.1 — Webhook Engine (Week 1)
- `webhook_configs` table (tenant, url, secret, events[], enabled)
- `webhook_deliveries` table (event, payload_json, status, attempts, error, delivered_at)
- Background delivery service with retry
- `POST /enterprise/webhooks/config` — create/update
- `GET /enterprise/webhooks/deliveries` — delivery log
- `POST /enterprise/webhooks/test/:event` — test fire

### Milestone 5.2 — Event Emission (Week 1-2)
- Instrument existing routes to emit events on key actions
- Events: shortlist lifecycle, upload, approval

### Milestone 5.3 — n8n Templates (Week 2)
- Export n8n workflow JSON files for: Gmail outreach, Teams approval card, calendar invite
- Documentation: how to import into n8n Cloud or self-hosted

### Milestone 5.4 — Integrations Settings UI (Week 2)
- Settings page: n8n URL, secret, event toggles
- Webhook delivery log table
- Test button per event

---

*This document will be updated at the start of each phase with detailed API contracts, DB schemas, and UX wireframes.*
