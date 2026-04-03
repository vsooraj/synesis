# MatchPoint Enterprise — User Manual
**Version 1.0 | AI-Powered Talent Intelligence Platform**

---

## Table of Contents

1. [Platform Overview](#1-platform-overview)
2. [Getting Started](#2-getting-started)
3. [User Roles & Permissions](#3-user-roles--permissions)
4. [Resume Analyzer (Public)](#4-resume-analyzer-public)
5. [Candidate Pool](#5-candidate-pool)
6. [Job Descriptions](#6-job-descriptions)
7. [Bulk Analysis](#7-bulk-analysis)
8. [Talent Pool Search](#8-talent-pool-search)
9. [Skills Gap Analytics](#9-skills-gap-analytics)
10. [AI Shortlisting Agent](#10-ai-shortlisting-agent)
11. [RAG Candidate Q&A](#11-rag-candidate-qa)
12. [Position Board (HR Ticketing)](#12-position-board-hr-ticketing)
13. [Interview Scheduling](#13-interview-scheduling)
14. [Structured Interview Feedback](#14-structured-interview-feedback)
15. [Outlook & Teams Integration](#15-outlook--teams-integration)
16. [Integration Hub & Webhooks](#16-integration-hub--webhooks)
17. [Audit Log](#17-audit-log)
18. [Team Management](#18-team-management)
19. [QA Test Scenarios](#19-qa-test-scenarios)
20. [Full Feature Reference](#20-full-feature-reference)

---

## 1. Platform Overview

MatchPoint Enterprise is an end-to-end AI-powered talent intelligence and recruiter operations platform. It covers the complete hiring lifecycle — from resume intake and AI scoring through candidate shortlisting, position tracking, and structured interview management — all within a single secure, multi-tenant environment.

**Core capabilities at a glance:**

| Area | What it does |
|---|---|
| Resume Analysis | AI-scores resumes against job descriptions with detailed feedback |
| Candidate Pool | Central repository for all candidate profiles and documents |
| Bulk Analysis | Score hundreds of candidates against one JD in a single job |
| Talent Search | Semantic full-text search across all resumes |
| AI Shortlisting | Autonomous agent ranks candidates and generates shortlists for HR approval |
| RAG Q&A | Ask plain-English questions answered with cited sources from resumes |
| Position Board | 7-column Kanban board for tracking every open role |
| Interview Scheduling | Schedule, manage, and record feedback for all candidate interviews |
| Integrations | Webhook engine + n8n templates for Outlook, Teams, and Gmail automation |

---

## 2. Getting Started

### 2.1 Registering Your Organisation

1. Navigate to the app and click **Get Started** on the home page, or go to `/register`.
2. Fill in:
   - **Your name** and **email address**
   - **Password** (min 8 characters)
   - **Organisation name** — this becomes your tenant workspace; all data stays isolated to this org
3. Click **Create Account**.
4. You are automatically signed in as **super_admin** for your organisation.

### 2.2 Signing In

1. Go to `/login`.
2. Enter your email and password, then click **Sign In**.
3. Your session persists for 7 days. To sign out, click your avatar in the bottom-left of the sidebar and select **Sign out**.

### 2.3 Inviting Team Members

1. Open **Team** from the sidebar (requires hr_admin or super_admin role).
2. Click **Invite User**.
3. Enter name, email, a temporary password, and select a role.
4. The invited user can sign in immediately with those credentials.

---

## 3. User Roles & Permissions

| Role | Key Access |
|---|---|
| **super_admin** | Everything — full platform access, user management, webhook config |
| **hr_admin** | All analyses, bulk jobs, shortlist approval, user management |
| **hiring_manager** | Create job descriptions, view analyses for their positions |
| **recruiter** | Run analyses, manage candidates, schedule interviews |
| **employee** | Upload own resume, view own analyses only |

Sidebar navigation items are automatically shown or hidden based on your role. Enterprise features are not visible to unauthenticated visitors.

---

## 4. Resume Analyzer (Public)

The public analyzer is available without signing in at the home page (`/`).

### 4.1 How to Analyse a Resume

1. **Paste resume text** into the Resume field, or click **Upload PDF** to parse a PDF automatically.
2. **Paste a job description** into the Job Description field.
3. Click **Analyze Match**.
4. Within seconds you receive:
   - **Match Score** (0–100) — overall compatibility
   - **Section Scores** — breakdown across Experience, Education, Skills, and Certifications
   - **Matched Keywords** — skills/terms present in both resume and JD
   - **Missing Keywords** — important JD terms absent from the resume
   - **Strengths** — what the candidate does well relative to the JD
   - **Gaps** — areas that need improvement or are absent
   - **Suggestions** — specific, actionable recommendations

### 4.2 Viewing History

Click **History** in the top navigation to see all analyses you have run in this browser session. Each row shows the date, score, and a link to re-open the full result.

### 4.3 Platform Stats

**Stats** in the top navigation shows aggregate platform-wide metrics: total analyses run, average match score, and score distribution by range.

---

## 5. Candidate Pool

Accessed via **Candidates** in the sidebar (login required).

### 5.1 Adding a Candidate

1. Click **Add Candidate**.
2. Choose **Upload PDF** or **Paste Text**.
3. Optionally fill in **Candidate Name** and **Email** if not extracted automatically.
4. Click **Save**. The profile appears in the candidate list.

### 5.2 Candidate List

Each row in the list shows:
- Candidate name and email
- Upload date
- A link to view the full profile

### 5.3 Candidate Profile

Click any candidate to see:
- Their resume text
- All past analyses linked to this candidate
- Option to run a new analysis against any active job description

---

## 6. Job Descriptions

Accessed via **Job Descriptions** in the sidebar.

### 6.1 Creating a Job Description

1. Click **New Job Description**.
2. Enter **Title**, **Company**, **Department**, and paste the full **Job Description** text.
3. Set the **Status**: Draft (not yet live), Active (open for use), or Closed.
4. Click **Save**.

### 6.2 Managing JDs

- **Edit** — update any field. Status changes are logged in the audit trail.
- **Delete** — permanently removes the JD (prompts for confirmation).
- **Filter by status** — use the status pills at the top to filter the list.

### 6.3 Using a JD for Analysis

Active JDs are available in the Bulk Analysis job selector and the Shortlisting Agent. Draft JDs can be used for individual analysis runs.

---

## 7. Bulk Analysis

Accessed via **Bulk Analysis** in the sidebar (hr_admin and above).

Bulk Analysis lets you score an entire candidate pool against one job description in a single automated job.

### 7.1 Running a Bulk Job

1. Click **New Bulk Job**.
2. Select an **Active Job Description** from the dropdown.
3. Choose the candidates to include (checkboxes in the candidate list, or select all).
4. Click **Run Analysis**.
5. The job is queued. Processing happens asynchronously — the page auto-refreshes every 10 seconds.

### 7.2 Viewing Results

When the job reaches **Completed** status:
- A results table appears showing each candidate, their match score, and key gaps.
- Click any row to see the full analysis breakdown.
- Click **Export CSV** to download all results in a spreadsheet.

### 7.3 Job Statuses

| Status | Meaning |
|---|---|
| Pending | Job created, not yet started |
| Running | AI analysis in progress |
| Completed | All candidates processed |
| Failed | One or more candidates could not be analysed |

---

## 8. Talent Pool Search

Accessed via **Talent Search** in the sidebar.

Search across every resume in your candidate pool using natural language or keyword queries.

### 8.1 Running a Search

1. Type a query — for example: *"Python developer with AWS experience"* or *"senior engineer machine learning"*.
2. Press **Enter** or click **Search**.
3. Results are ranked by relevance using TF-IDF semantic matching.

### 8.2 Understanding Results

Each result card shows:
- **Candidate name** and email
- **Relevance score** (0–100)
- **Best-matching snippet** — the exact text from the resume that matched your query, with matched terms highlighted
- A **View Profile** link

---

## 9. Skills Gap Analytics

Accessed via **Analytics** in the sidebar.

Gives a bird's-eye view of skills gaps and strengths across your entire candidate pool.

### 9.1 Charts Available

- **Top Skills Gaps** — horizontal bar chart of the most common missing skills across all analyses, ranked by frequency
- **Top Strengths** — bar chart of the most common strengths identified
- **Score Distribution** — histogram showing how many candidates fall into each score bracket (0–20, 20–40, 40–60, 60–80, 80–100)
- **Section Score Radar** — average scores per resume section (Experience, Skills, Education, Certifications) shown as a radial chart

### 9.2 Filtering

Use the **Job Description** dropdown to filter all charts to analyses run against one specific JD.

---

## 10. AI Shortlisting Agent

Accessed via **AI Agent** in the sidebar (hr_admin and above).

The Agent autonomously ranks and evaluates your entire candidate pool for a chosen position, then presents a ranked shortlist to HR for approval.

### 10.1 Starting a Shortlisting Run

1. Click **New Shortlist**.
2. Select the **Job Description** you want to shortlist for.
3. Optionally set the **maximum number of candidates** to shortlist.
4. Click **Start Agent**.

### 10.2 What the Agent Does

The agent works in stages (visible in real-time in the Step Log):

| Stage | Description |
|---|---|
| Search | TF-IDF semantic ranking retrieves the most relevant candidates |
| Analyse | GPT-5.2 individually evaluates each retrieved candidate against the JD |
| Rank | Candidates are sorted by composite score |
| Report | A shortlist report is generated with reasoning per candidate |
| Awaiting Approval | Agent pauses and notifies HR for human review |

### 10.3 HR Approval / Rejection

1. When a shortlist reaches **Pending Approval** status, the HR admin receives a notification (webhook) and sees an **Approve** or **Reject** button on the shortlist card.
2. **Approve** — locks the shortlist and triggers a `shortlist.approved` webhook (e.g. Gmail outreach via n8n).
3. **Reject** — marks it rejected with an optional note; triggers `shortlist.rejected` webhook.

### 10.4 Shortlist Report

The report includes:
- Ranked list of candidates with individual match scores
- Per-candidate reasoning from the AI
- Strengths and concerns for each candidate
- The agent's step-by-step log for transparency

---

## 11. RAG Candidate Q&A

Accessed via **Candidate Q&A** in the sidebar.

Ask any question in plain English and get a cited answer generated from actual resume content.

### 11.1 How to Use

1. Type a question in the chat input — for example:
   - *"Which candidates have experience with Kubernetes?"*
   - *"Who has led a team of more than 10 people?"*
   - *"Find candidates with a Master's degree in Computer Science"*
2. Press **Enter** or click **Send**.
3. The system retrieves the most relevant resume sections using BM25 ranking, then GPT-5.2 synthesises a cited answer.

### 11.2 Understanding Answers

Each response shows:
- **The AI-generated answer** in plain English
- **Source citations** — each cited source shows: candidate name, resume section (e.g. Work Experience), the exact snippet used, and a BM25 relevance score

This ensures every answer is traceable to real candidate data — no hallucinations.

---

## 12. Position Board (HR Ticketing)

Accessed via **Position Board** in the sidebar.

The Position Board tracks every open role through a structured hiring pipeline.

### 12.1 Kanban Board

The board has 7 columns representing stages in the hiring process:

| Column | Meaning |
|---|---|
| **Draft** | Position being defined, not yet public |
| **Open** | Actively accepting applications |
| **Sourcing** | Recruiters actively searching for candidates |
| **Screening** | Resume reviews and initial phone screens |
| **Interviewing** | Candidates in active interview rounds |
| **Offer** | Offer extended, awaiting response |
| **Closed** | Position filled or cancelled |

**Drag and drop** any ticket card between columns to update its status instantly.

### 12.2 Creating a Position Ticket

1. Click **New Position** (top right of the board).
2. Fill in:
   - **Title** — e.g. *Senior Backend Engineer*
   - **Priority** — Critical, High, Medium, or Low
   - **Department** and **Location**
   - **Number of Openings**
   - **Description** and optionally link to a **Job Description**
   - **Target Start Date**
3. Click **Create**. The ticket appears in the Draft column.

### 12.3 SLA Deadlines

Each priority level has a built-in SLA target (time to fill):

| Priority | SLA |
|---|---|
| Critical | 14 days |
| High | 30 days |
| Medium | 60 days |
| Low | 90 days |

Tickets approaching their deadline show a **yellow warning** badge. Tickets past the deadline show a **red breach** badge.

### 12.4 Ticket Detail

Click any ticket card to open the detail view. It contains:

**Left panel:**
- Position metadata (priority, department, location, openings, dates)
- **Candidate Pipeline** — add candidates to this position, track their stage (Applied → Screening → Interview → Final → Offered → Hired → Rejected), and remove candidates
- **Interviews panel** — all interviews scheduled for this position, with a **Schedule** button to create new ones

**Right panel:**
- **Activity Feed** — chronological log of every status change, candidate added/removed, and comment
- **Comments** — add internal notes visible to the whole team

### 12.5 Recruiter Workload View

Click **Workload** in the sidebar (or the workload button on the board) to see a bar chart of how many active tickets each recruiter owns, plus counts of SLA breaches and warnings per person.

---

## 13. Interview Scheduling

Accessed via **Interviews** in the sidebar, and also within individual ticket detail pages.

### 13.1 Scheduling an Interview

**From ticket detail:**
1. Open a position ticket.
2. Scroll down to the **Interviews** panel in the left column.
3. Click **Schedule**.
4. Fill in the scheduling dialog:
   - **Date & Time** — datetime picker
   - **Duration** — 30, 45, 60, 90, or 120 minutes
   - **Interview Type** — Phone, Video, Technical, Onsite, or Panel
   - **Interviewers** — comma-separated email addresses of all interviewers
   - **Meeting Link** — appears when type is Video (paste Teams/Zoom/Meet URL)
   - **Location** — appears when type is Onsite or Panel
   - **Notes** — preparation instructions or topics to cover
5. Click **Schedule**. The interview appears immediately in the panel.

**From the Interviews page:**
Scheduling is always done from within a ticket. Use the Interviews page to manage and review interviews across all positions.

### 13.2 Interviews Page

The `/interviews` page shows all interviews across every position in a day-grouped timeline.

**Filter pills** (top right):
| Filter | Shows |
|---|---|
| Upcoming | All Scheduled interviews in the next 60 days |
| Scheduled | All interviews with Scheduled status |
| Completed | All completed interviews |
| Cancelled | Cancelled and No-show interviews |
| All | Every interview regardless of status |

**Default view is Scheduled** when you first open the page.

### 13.3 Interview Card

Each card shows:
- Candidate name and email (if linked)
- Status badge (Scheduled / Completed / Cancelled / No-show)
- Interview type badge with icon (Video camera, Phone, etc.)
- Date and time, duration
- Link to the position ticket
- Interviewer email addresses
- Meeting link button (if applicable)
- Notes snippet

**Actions on Scheduled cards:**
- **Join Meeting** — opens the meeting link in a new tab
- **Add to Calendar** — downloads a `.ics` file for Outlook / Google Calendar / Apple Calendar
- **Complete** — opens the feedback dialog to mark the interview done
- **No-show** — marks the candidate as a no-show
- **Cancel** — cancels the interview

**Actions on Completed cards:**
- **Join Meeting** (if applicable)
- **Add to Calendar**
- **Request Feedback** — sends a Teams DM or email to all interviewers asking them to submit their feedback (fires a webhook)

### 13.4 Cancelling an Interview

Click **Cancel** on any Scheduled interview card. The status updates to Cancelled immediately. Cancelled interviews appear in the Cancelled filter.

---

## 14. Structured Interview Feedback

When you click **Complete** on a Scheduled interview, the feedback dialog opens.

### 14.1 Feedback Dimensions

Rate the candidate across 6 dimensions, each on a 1–5 star scale:

| Dimension | What to assess |
|---|---|
| **Technical Skills** | Depth of domain knowledge, coding ability, or technical expertise |
| **Communication** | Clarity of expression, listening skills, articulation |
| **Problem Solving** | Approach to novel problems, logical reasoning, creativity |
| **Culture Fit** | Alignment with company values and team dynamics |
| **Relevant Experience** | How directly their background matches the role |
| **Motivation** | Enthusiasm for the role, company, and career trajectory |

Click a star to set the score. An optional **comment box** appears below each scored dimension for a brief note.

### 14.2 Computed Overall Rating

Once any dimension is scored, an amber **Computed Overall Rating** box appears showing the automatic average across all scored dimensions. This becomes the stored overall rating.

### 14.3 Overall Summary

Write a free-text **Overall Summary** — key highlights, recommendation, and any concerns. The Save Feedback button is only enabled once at least one dimension is scored or a summary is written.

### 14.4 Viewing Completed Feedback

On completed interview cards, the scorecard is shown inline:
- A compact table with each dimension and its star rating
- Comment snippets where provided
- The overall summary paragraph below

---

## 15. Outlook & Teams Integration

### 15.1 Add to Calendar (.ics)

Every interview card (regardless of status) has an **Add to Calendar** button with a calendar icon.

Clicking it instantly downloads a `.ics` calendar file containing:
- Event title with position name and candidate name
- Start and end times (based on scheduled time + duration)
- All interviewers listed as calendar attendees
- Meeting link in the location field
- Full event description with candidate details and notes

**Compatible with:** Microsoft Outlook, Google Calendar, Apple Calendar, and any RFC-5545-compliant calendar app.

> **QA Note:** After clicking the button the page does not navigate away. The file download starts silently in the background. Check your browser's Downloads folder.

### 15.2 Request Feedback (Teams)

On any **Completed** interview card, the **Request Feedback** button (indigo, with Send icon) fires a `interview.feedback_requested` webhook event.

If you have connected the **Teams — Interviewer Feedback Request** n8n template, this automatically sends a personalised Teams DM to every interviewer on that interview, asking them to log in to MatchPoint Enterprise and submit their structured feedback.

A **toast notification** confirms: *"Feedback requested from N interviewer(s)"*

---

## 16. Integration Hub & Webhooks

Accessed via **Integrations** in the sidebar (super_admin / hr_admin).

### 16.1 Configuring Your Webhook Endpoint

1. Go to **Integrations**.
2. Enter your **Webhook URL** — the endpoint that will receive events (typically your n8n webhook trigger URL).
3. Optionally add a **Description** to remind you what this webhook does.
4. Select which **events** to subscribe to (see list below).
5. Toggle **Enabled** on/off without deleting the configuration.
6. Click **Save**.

Your webhook **secret** is shown in the n8n credential setup. Use it to verify HMAC-SHA256 signatures on every incoming request.

### 16.2 Webhook Events

| Event | Triggered when |
|---|---|
| `candidate.uploaded` | A resume is added to the candidate pool |
| `shortlist.pending_approval` | The AI agent finishes and is waiting for HR review |
| `shortlist.approved` | HR approves a shortlist |
| `shortlist.rejected` | HR rejects a shortlist |
| `bulk_job.completed` | A bulk analysis job finishes |
| `position.opened` | A position ticket is created and set to Open |
| `position.closed` | A position ticket is moved to Closed |
| `interview.scheduled` | An interview is scheduled |
| `interview.feedback_requested` | Recruiter requests feedback from interviewers |

### 16.3 Delivery Log

The **Delivery Log** shows recent webhook attempts with:
- Event type
- Delivery status (delivered / failed / retrying / pending)
- HTTP response code
- Number of retry attempts
- Timestamp

The system retries failed deliveries up to 3 times with exponential backoff.

### 16.4 Test Events

Click the **Send** button next to any event to fire a test payload to your webhook URL immediately. Use this to verify your n8n workflow is receiving and processing events correctly.

### 16.5 n8n Workflow Templates

Download ready-made n8n workflow JSON files and import them into your n8n instance (Workflows → Import). Templates are organised by category:

**Shortlisting & Pipeline:**

| Template | Event | What it does |
|---|---|---|
| Gmail Outreach on Shortlist Approval | `shortlist.approved` | Sends a personalised Gmail to each shortlisted candidate |
| Teams Approval Card | `shortlist.pending_approval` | Posts an Adaptive Card to MS Teams for HR to review |
| Outlook Daily Digest | — | Sends a daily HTML pipeline summary via Outlook |

**Interview Scheduling:**

| Template | Event | What it does |
|---|---|---|
| Teams — Interview Scheduled Notification | `interview.scheduled` | Posts an Adaptive Card to a Teams channel with date, type, interviewers, and a Join Meeting button |
| Outlook — Calendar Invite for Interview | `interview.scheduled` | Creates an Outlook calendar event for every interviewer via Microsoft Graph |
| Teams — Interviewer Feedback Request | `interview.feedback_requested` | Sends a personalised Teams DM to each interviewer requesting feedback |

> **Setup:** After importing a template, update the credential fields (Teams channel ID, Outlook account, Gmail account) and set your MatchPoint webhook secret in the n8n Header Auth credential.

### 16.6 Signature Verification

Every webhook request sent by MatchPoint includes an `X-MatchPoint-Signature` header.

Verification: Compute `HMAC-SHA256(your_secret, raw_request_body)` and compare the hex digest (prefixed `sha256=`) with the header value. Reject any request that does not match.

---

## 17. Audit Log

Accessed via **Audit Log** in the sidebar (hr_admin and above).

The audit log is an immutable, append-only record of every significant action performed on your tenant.

### 17.1 What Is Logged

- User authentication events
- Candidate uploads and deletions
- Job description create / edit / delete
- Bulk job submissions and completions
- Shortlist creation, approval, and rejection
- Position ticket create, status changes, candidate additions
- Interview schedule, complete, cancel, no-show, and feedback-request events

### 17.2 Reading the Log

Each row shows:
- **Timestamp**
- **Action** — what happened (e.g. `CREATE_INTERVIEW`, `APPROVE_SHORTLIST`)
- **Actor** — which user performed the action
- **Resource type** and **ID**
- **Metadata** — relevant context (e.g. score, reason, ticket title)

The log cannot be edited or deleted. It provides a full compliance trail.

---

## 18. Team Management

Accessed via **Team** in the sidebar (hr_admin and above).

### 18.1 Viewing the Team

The team page lists all users in your organisation with their name, email, role, and join date.

### 18.2 Inviting a User

1. Click **Invite User**.
2. Enter **Name**, **Email**, **Temporary Password**, and **Role**.
3. Click **Invite**. The user can sign in immediately.

### 18.3 Roles Summary

See [Section 3](#3-user-roles--permissions) for the full permissions matrix.

---

## 19. QA Test Scenarios

The following scenarios cover the full end-to-end workflow for QA validation.

---

### QA-01: Organisation Registration and Login

**Steps:**
1. Navigate to `/register`
2. Enter name, email, password, and a unique organisation name
3. Click Create Account
4. Verify automatic redirect to the dashboard (logged in as super_admin)
5. Click avatar → Sign out
6. Navigate to `/login`, enter credentials, click Sign In
7. Verify redirect to dashboard

**Expected:** Registration and login succeed; sidebar shows all enterprise nav items.

---

### QA-02: Resume Analysis (Public)

**Steps:**
1. Navigate to `/` (without signing in)
2. Paste a resume and a job description
3. Click Analyze Match
4. Verify score, section breakdown, keywords, strengths, gaps, and suggestions appear

**Expected:** Analysis completes in under 10 seconds with all 6 result sections populated.

---

### QA-03: Candidate Upload

**Steps:**
1. Sign in as recruiter
2. Go to Candidates → Add Candidate
3. Upload a PDF resume
4. Verify candidate appears in list with parsed name/email

**Expected:** Candidate appears with extracted name and email. Audit log records `UPLOAD_RESUME`.

---

### QA-04: Job Description Lifecycle

**Steps:**
1. Go to Job Descriptions → New Job Description
2. Create a JD in Draft status
3. Edit it, change status to Active
4. Verify it appears in the bulk job selector
5. Change status to Closed
6. Verify it no longer appears in the bulk job selector

**Expected:** Status transitions work; Active JDs are available for analysis; Closed JDs are not.

---

### QA-05: Bulk Analysis

**Steps:**
1. Go to Bulk Analysis → New Bulk Job
2. Select an Active JD, select ≥3 candidates
3. Click Run Analysis
4. Wait for job to reach Completed status
5. Verify results table shows all candidates with scores
6. Click Export CSV

**Expected:** All candidates appear in results; CSV download contains correct headers and data.

---

### QA-06: Talent Pool Search

**Steps:**
1. Go to Talent Search
2. Enter a skill term present in at least one uploaded resume
3. Verify ranked results appear with highlighted snippets
4. Enter a term not present in any resume
5. Verify "No results" message appears

**Expected:** Search returns relevant candidates; snippets highlight matched terms.

---

### QA-07: AI Shortlisting Agent

**Steps:**
1. Go to AI Agent → New Shortlist
2. Select an Active JD, set max candidates to 5
3. Click Start Agent
4. Watch the Step Log update in real time (Search → Analyse → Rank → Report)
5. When status reaches Pending Approval, click Approve
6. Verify status changes to Approved and shortlist report is visible

**Expected:** Agent completes all stages; HR approval flow works; `shortlist.approved` webhook fires.

---

### QA-08: RAG Candidate Q&A

**Steps:**
1. Go to Candidate Q&A
2. Ask: *"Which candidates have experience with TypeScript?"*
3. Verify answer cites specific candidates and resume sections
4. Ask a nonsense question
5. Verify system responds gracefully (e.g. "No relevant candidates found")

**Expected:** Answers include source citations with candidate names and snippet text.

---

### QA-09: Position Board — Full Kanban Flow

**Steps:**
1. Go to Position Board → New Position
2. Create a Critical priority position
3. Verify it appears in the Draft column with a red Critical badge
4. Drag the card to Open → verify SLA badge appears
5. Continue dragging through Sourcing → Screening → Interviewing → Offer → Closed
6. Verify each column transition is logged in the ticket's Activity Feed

**Expected:** Drag-and-drop updates column; SLA badge shows warning/breach at appropriate time.

---

### QA-10: Interview Scheduling and Management

**Steps:**
1. Open a ticket in Interviewing status
2. Scroll to Interviews panel → click Schedule
3. Set datetime to tomorrow at 10:00, type Video, add one interviewer email, paste a Teams meeting URL
4. Click Schedule
5. Verify interview card appears in the Interviews panel with Scheduled badge
6. Go to Interviews page → verify the new interview appears under Scheduled filter
7. Click Add to Calendar — verify .ics file downloads
8. Click Complete
9. In the feedback dialog: score Technical Skills 5 stars, Communication 4 stars
10. Verify Computed Overall Rating appears
11. Write a summary, click Save Feedback
12. Verify filter switches to Completed; card shows green badge and scorecard
13. Click Request Feedback — verify toast: "Feedback requested from 1 interviewer(s)"

**Expected:** Full scheduling → feedback → notification cycle completes without errors.

---

### QA-11: Integration Hub

**Steps:**
1. Go to Integrations
2. Enter a test webhook URL (e.g. from webhook.site), select all events, click Save
3. Fire a test event for `interview.scheduled`
4. Verify the delivery log shows a new entry
5. Check webhook.site for the received payload
6. Scroll to n8n Workflow Templates → verify two category sections
7. Click JSON download for any Interview Scheduling template
8. Verify a valid JSON file downloads

**Expected:** Webhook delivers within 3 seconds; delivery log shows HTTP 200; JSON file is valid n8n workflow format.

---

### QA-12: Audit Log

**Steps:**
1. Perform any action (upload candidate, schedule interview, approve shortlist)
2. Go to Audit Log
3. Verify the most recent entry matches the action just performed

**Expected:** Every action appears in the audit log within seconds.

---

### QA-13: Role-Based Access Control

**Steps:**
1. Invite a user with the `employee` role
2. Sign in as that user
3. Verify the sidebar only shows public navigation items
4. Attempt to navigate to `/candidates` directly
5. Verify redirect to login or access denied

**Expected:** Employee role cannot access enterprise features.

---

## 20. Full Feature Reference

### Authentication & Multi-Tenancy
- Organisation registration with automatic super_admin assignment
- JWT authentication (7-day token, stored in browser local storage)
- 5 user roles with granular sidebar and API access control
- Complete data isolation per tenant — no cross-tenant data leakage
- User invitation flow with role assignment

### Resume Intelligence
- PDF upload with automatic text extraction
- Plain-text paste alternative
- GPT-5.2 powered analysis against any job description
- Match score (0–100), section scores (4 dimensions), keyword matching
- Strengths, gaps, and actionable suggestions
- Analysis history per candidate

### Candidate Pool
- Unlimited candidate storage per tenant
- PDF parse and structured storage
- TF-IDF semantic search with snippet highlighting (BM25 scoring)
- Bulk analysis across entire pool

### Job Description Management
- Full CRUD with Draft / Active / Closed lifecycle
- Linked to analyses, bulk jobs, shortlists, and position tickets
- Active JDs are available across the platform; Closed JDs are archived

### Bulk Analysis Engine
- Select any combination of candidates against one JD
- Async background processing (does not block the UI)
- Live progress counter with auto-refresh
- Per-candidate results with scores and gaps
- CSV export of all results

### Skills Gap Analytics
- Top gaps and strengths ranked by frequency across all analyses
- Score distribution histogram
- Section score radar chart
- JD-scoped filtering

### AI Shortlisting Agent
- Autonomous multi-stage pipeline (TF-IDF → GPT-5.2 analysis → ranking → report)
- Real-time step log for transparency and auditability
- Human-in-the-loop: requires HR approval before shortlist is acted upon
- Approval / rejection with notes
- Webhook events on each approval action

### RAG Candidate Q&A
- Resumes chunked by section on upload for precise retrieval
- BM25 ranking retrieves the top relevant passages
- GPT-5.2 synthesises a cited, grounded answer
- Source citations showing candidate name, section, snippet, and relevance score

### Position Board (HR Ticketing)
- 7-column Kanban (Draft → Open → Sourcing → Screening → Interviewing → Offer → Closed)
- Drag-and-drop status transitions with instant save
- Priority-based SLA engine (Critical 14d / High 30d / Medium 60d / Low 90d)
- SLA warning and breach badges visible on card and workload view
- Ticket detail: metadata, candidate pipeline, interview panel, activity feed, comments
- Recruiter workload chart with SLA breach counts
- Webhooks on position.opened and position.closed events

### Interview Scheduling
- Linked to position tickets and individual candidates
- Interview types: Phone, Video, Technical, Onsite, Panel
- Interviewers list (comma-separated emails, stored as JSON array)
- Meeting link (Video), location (Onsite/Panel), notes
- Status lifecycle: Scheduled → Completed / Cancelled / No-show
- `/interviews` page with day-grouped timeline and filter pills
- `interview.scheduled` webhook event with full payload

### Structured Interview Feedback
- 6-dimension scoring: Technical Skills, Communication, Problem Solving, Culture Fit, Relevant Experience, Motivation
- 1–5 star rating per dimension with optional comment
- Computed average overall rating from dimension scores
- Free-text overall summary
- Feedback stored as structured JSON alongside the interview record
- Dimension scorecard displayed inline on completed interview cards

### Outlook & Calendar Integration
- Client-side `.ics` file generation for any interview
- RFC-5545 compliant (Outlook, Google Calendar, Apple Calendar)
- Includes all interviewers as attendees, meeting link in location field
- No backend dependency — instant download

### Teams Integration (via Webhooks)
- `interview.feedback_requested` event with interviewer list payload
- n8n template: Teams Interview Notification — Adaptive Card on schedule
- n8n template: Teams Feedback Request — personalised DM to each interviewer
- n8n template: Outlook Calendar Invite — MS Graph calendar event creation

### Integration Hub
- HMAC-SHA256 signed webhook delivery
- Per-tenant webhook configuration with event-level filtering
- 3-attempt retry with exponential backoff
- Delivery log with status, HTTP code, error message, and timestamp
- Test event firing for each event type
- 6 downloadable n8n workflow templates in two categories
- `interview.scheduled` and `interview.feedback_requested` in event registry

### Audit Log
- Immutable append-only audit trail
- Covers all create, update, delete, and status-change actions
- Shows actor, action, resource, timestamp, and metadata
- Cannot be modified or deleted

---

*MatchPoint Enterprise — Built with TypeScript, Express, React, PostgreSQL, and GPT-5.2*
*Documentation current as of Version 1.0*
