# Product Requirements Document
## MatchPoint — Resume & Job Description Matching Analysis

**Version:** 1.0  
**Date:** April 3, 2026  
**Status:** Live

---

## 1. Overview

### 1.1 Product Summary
MatchPoint is an AI-powered web application that analyzes a candidate's resume against a specific job description and produces a detailed match report. It helps job seekers understand how well they fit a role, identify gaps in their profile, and get actionable feedback to improve their chances before applying.

### 1.2 Problem Statement
Job seekers often apply to roles without knowing how well their resume aligns with the requirements. Hiring systems (ATS) filter candidates by keyword matching before a human ever reads the resume. Candidates lack visibility into this process and miss opportunities due to fixable gaps in their resume presentation.

### 1.3 Solution
MatchPoint uses a large language model (GPT-5.2) to simulate the perspective of a senior recruiter. It reads both the resume and job description, scores the match across multiple dimensions, highlights what's working, what's missing, and prescribes concrete improvements.

---

## 2. Goals & Success Metrics

| Goal | Metric |
|---|---|
| Help users understand their resume-JD fit | Average session ends on a results page (not abandoned at analyzer) |
| Provide actionable feedback | Each analysis includes ≥5 suggestions |
| Retain users for multiple applications | Users run >1 analysis (tracked via History) |
| Fast time-to-insight | Analysis completes in under 30 seconds |

---

## 3. Users

### Primary User
**Active job seeker** — someone actively applying to roles who wants to maximize their chances. They paste their resume and a JD copied from a job board (LinkedIn, Indeed, company careers page).

### Secondary User
**Career coach / recruiter** — uses the tool to help clients improve their resumes before submission.

---

## 4. Features

### 4.1 Analyzer (Core Feature)
The primary input screen where users submit their resume and job description for analysis.

**Inputs:**
- Resume text (plain text, required, min 100 characters)
- Job description text (plain text, required, min 50 characters)
- Job title (optional label)
- Company name (optional label)

**Behavior:**
- On submit, calls the AI analysis endpoint
- Shows a loading state during processing (~5–20 seconds)
- On success, automatically navigates to the Results page
- On failure, shows a toast notification with the error message

---

### 4.2 Results Page
Displays the full analysis report for a single resume–JD pair.

**Components:**

| Component | Description |
|---|---|
| Overall Match Score | Circular ring gauge showing score 0–100 |
| Summary | 2–3 sentence AI-written assessment |
| Section Scores | Progress bars for Skills, Experience, Education, Keywords (each 0–100) |
| Strengths | Bulleted list of what the resume does well for this role |
| Gaps | Bulleted list of missing requirements or weak areas |
| Actionable Suggestions | Numbered list of specific, concrete improvements |
| Keyword Analysis | Color-coded grid of matched vs. missing keywords by importance (high / medium / low) |

**Actions:**
- Navigate back to History
- Delete the analysis (with confirmation dialog)

---

### 4.3 History
A list of all past analyses for the current session/device.

**Displays per entry:**
- Job title and company name (if provided)
- Overall match score
- Summary snippet
- Date and time of analysis

**Actions:**
- Click any entry to open its Results page
- Delete individual entries from the Results page

---

### 4.4 Stats Dashboard
An aggregate view across all analyses run.

**Metrics displayed:**
- Total analyses run
- Average match score
- Highest score achieved
- Lowest score achieved
- Recent analyses list (last 5)

---

## 5. AI Analysis Engine

### 5.1 Model
- **Provider:** OpenAI via Replit AI Integrations
- **Model:** GPT-5.2 (general-purpose, latest)
- **Response format:** Structured JSON object

### 5.2 Analysis Output Schema

```
{
  overallScore: number (0–100),
  summary: string,
  strengths: string[],
  gaps: string[],
  matchedKeywords: [{ keyword, found: boolean, importance: "high"|"medium"|"low" }],
  missingKeywords: string[],
  suggestions: string[],
  sectionScores: {
    skills: number,
    experience: number,
    education: number,
    keywords: number
  }
}
```

### 5.3 Keyword Extraction
The AI extracts 10–15 keywords from the job description and assesses each against the resume. Keywords are tagged with importance level (high, medium, low) and found/missing status.

---

## 6. API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/resume/analyze` | Run AI analysis on resume + JD |
| GET | `/api/resume/analyses` | List all past analyses (summary) |
| GET | `/api/resume/analyses/:id` | Get full analysis by ID |
| DELETE | `/api/resume/analyses/:id` | Delete an analysis |
| GET | `/api/resume/stats` | Get aggregate statistics |

---

## 7. Data Model

### Analysis Record
| Field | Type | Description |
|---|---|---|
| id | integer | Primary key |
| jobTitle | text (nullable) | Optional label |
| companyName | text (nullable) | Optional label |
| resumeText | text | Full resume input |
| jobDescription | text | Full JD input |
| overallScore | real | 0–100 match score |
| summary | text | AI-written summary |
| strengths | jsonb (string[]) | List of strengths |
| gaps | jsonb (string[]) | List of gaps |
| matchedKeywords | jsonb | Keyword match array |
| missingKeywords | jsonb (string[]) | Missing keyword list |
| suggestions | jsonb (string[]) | Improvement suggestions |
| sectionScores | jsonb | Skills/experience/education/keywords scores |
| createdAt | timestamp | Auto-set on insert |

---

## 8. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite, TypeScript, Tailwind CSS |
| UI Components | Radix UI, shadcn/ui |
| Routing | Wouter |
| State / Data | TanStack React Query |
| Backend | Express 5, Node.js, TypeScript |
| Database | PostgreSQL + Drizzle ORM |
| AI | OpenAI GPT-5.2 via Replit AI Integrations |
| API Contract | OpenAPI 3.1 + Orval codegen |
| Hosting | Replit |

---

## 9. Non-Functional Requirements

| Requirement | Target |
|---|---|
| Analysis latency | < 30 seconds end-to-end |
| Uptime | 99%+ (Replit-hosted) |
| Input size | Resume up to ~10,000 characters, JD up to ~5,000 characters |
| Data persistence | Analyses stored in PostgreSQL, survive server restarts |
| Security | No user authentication required; data is not user-scoped in v1 |

---

## 10. Out of Scope (v1)

- User accounts / authentication
- PDF or DOCX file upload (plain text only)
- Resume editing / rewriting inside the app
- Side-by-side resume editor with live score updates
- Email or export of results
- Multi-language support
- Mobile app

---

## 11. Future Considerations (v2+)

- **User accounts** — Save analyses per user, not per device
- **File upload** — Accept PDF/DOCX and extract text automatically
- **Resume rewriter** — AI-assisted rewrite of resume bullets to target a specific JD
- **Cover letter generator** — Generate a tailored cover letter from the match analysis
- **ATS simulation** — Estimate likelihood of passing common ATS filters
- **Bulk analysis** — Upload one resume, compare against multiple JDs at once
