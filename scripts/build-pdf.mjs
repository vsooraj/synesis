/**
 * MatchPoint Enterprise — User Manual PDF Generator (pdfkit)
 * Usage:  node scripts/build-pdf.mjs
 * Output: docs/MatchPoint-Enterprise-User-Manual.pdf
 */

import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, "..");
const SS_DIR    = path.join(ROOT, "screenshots", "manual");
const OUT_FILE  = path.join(ROOT, "docs", "MatchPoint-Enterprise-User-Manual.pdf");

fs.mkdirSync(path.join(ROOT, "docs"), { recursive: true });

// ── Colours ──────────────────────────────────────────────────────────────────
const C = {
  primary:   "#0f4c75",
  accent:    "#1b9aaa",
  teal:      "#14b8a6",
  light:     "#f0f9ff",
  border:    "#e2e8f0",
  text:      "#1e293b",
  muted:     "#64748b",
  white:     "#ffffff",
  red:       "#ef4444",
  amber:     "#f59e0b",
  green:     "#22c55e",
  indigo:    "#6366f1",
  purple:    "#a855f7",
  orange:    "#f97316",
  pink:      "#ec4899",
};

// ── Fonts ─────────────────────────────────────────────────────────────────────
const F = {
  bold:    "Helvetica-Bold",
  regular: "Helvetica",
};

// ── Page definitions ──────────────────────────────────────────────────────────
const PAGES = [
  {
    num:  "01",
    title: "Resume Analyzer",
    route: "/",
    screenshot: "01-home.jpg",
    color: C.teal,
    badge: "PUBLIC",
    badgeColor: C.green,
    description:
      "The public Resume Analyzer is available without signing in. Paste your resume and a job description to receive an instant AI-powered match score with detailed feedback.",
    features: [
      "Match Score (0–100) — AI-computed overall compatibility",
      "Section Scores — Experience, Education, Skills, Certifications",
      "Matched Keywords — terms present in both resume and JD",
      "Missing Keywords — important JD terms absent from the resume",
      "Strengths — what the candidate does well relative to the JD",
      "Gaps — areas needing improvement or absent from the resume",
      "Actionable Suggestions — specific, prioritised recommendations",
    ],
  },
  {
    num:  "02",
    title: "Sign In",
    route: "/login",
    screenshot: "02-login.jpg",
    color: C.primary,
    badge: "PUBLIC",
    badgeColor: C.green,
    description:
      "Secure enterprise authentication. Enter your email and password to access enterprise features. Sessions last 7 days with JWT tokens stored securely.",
    features: [
      "Email + password authentication with bcrypt hashing",
      "JWT token valid for 7 days — no need to log in daily",
      "Automatic redirect to the last visited enterprise page",
      "Create Account link for new organisation registration",
      "Role-based access: navigation adapts to your permission level",
    ],
  },
  {
    num:  "03",
    title: "Create Organisation",
    route: "/register",
    screenshot: "03-register.jpg",
    color: C.primary,
    badge: "PUBLIC",
    badgeColor: C.green,
    description:
      "Register your company to unlock all enterprise features. You become the Super Admin for your organisation — the highest permission level.",
    features: [
      "Organisation name becomes your isolated tenant workspace",
      "Automatic Super Admin role on first registration",
      "All data is strictly isolated — no cross-tenant access ever",
      "Invite team members after registering from the Team page",
      "Up to 5 roles available: super_admin, hr_admin, hiring_manager, recruiter, employee",
    ],
  },
  {
    num:  "04",
    title: "Analysis History",
    route: "/history",
    screenshot: "04-history.jpg",
    color: C.accent,
    badge: "PUBLIC",
    badgeColor: C.green,
    description:
      "View all past resume analyses run in the current session. Each row shows the date, score, job title, and a summary of the AI's assessment.",
    features: [
      "Chronological list of all analyses in the current session",
      "Match score badge with colour coding (red/amber/green)",
      "Job title and company extracted from the job description",
      "AI summary snippet for a quick at-a-glance assessment",
      "Click any row to re-open the full detailed result",
    ],
  },
  {
    num:  "05",
    title: "Platform Statistics",
    route: "/stats",
    screenshot: "05-stats.jpg",
    color: C.accent,
    badge: "PUBLIC",
    badgeColor: C.green,
    description:
      "A dashboard showing aggregate metrics from all analyses run on the platform. Includes total count, average score, highest/lowest scores, and recent activity.",
    features: [
      "Total analyses count — all-time platform records",
      "Average match score across all analyses",
      "Highest and lowest scores with colour highlights",
      "Recent activity feed — latest 5 analyses at a glance",
      "Score breakdown by range — how candidates distribute across bands",
    ],
  },
  {
    num:  "06",
    title: "Candidate Pool",
    route: "/candidates",
    screenshot: "06-candidates.jpg",
    color: C.indigo,
    badge: "ENTERPRISE",
    badgeColor: C.primary,
    description:
      "Central repository for all candidate resumes in your organisation. Upload PDFs or paste text. All profiles are searchable and available for analysis.",
    features: [
      "Upload PDF resumes with automatic text extraction",
      "Paste plain-text resumes as an alternative",
      "Candidate name and email extracted or entered manually",
      "Search candidates by name or email in the list",
      "View full profile with all past analyses linked",
      "Used as the source pool for Bulk Analysis and AI Shortlisting",
      "All uploads logged in the immutable Audit Log",
    ],
  },
  {
    num:  "07",
    title: "Job Descriptions",
    route: "/jobs",
    screenshot: "07-jobs.jpg",
    color: C.indigo,
    badge: "ENTERPRISE",
    badgeColor: C.primary,
    description:
      "Create and manage the library of job descriptions used across all analyses. Three lifecycle states: Draft, Active, and Closed.",
    features: [
      "Full CRUD — create, edit, delete job descriptions",
      "Draft status — JD being written, not yet available for analysis",
      "Active status — available for bulk analysis and shortlisting",
      "Closed status — archived; no longer selectable for new analyses",
      "Filter the list by status using the tab pills",
      "JDs are automatically embedded for semantic similarity (text-embedding-3-small)",
      "Linked to bulk jobs, shortlists, and position tickets",
    ],
  },
  {
    num:  "08",
    title: "Bulk Analysis",
    route: "/bulk-jobs",
    screenshot: "08-bulk.jpg",
    color: C.orange,
    badge: "ENTERPRISE",
    badgeColor: C.primary,
    description:
      "Score your entire candidate pool against one job description in a single automated job. Results include per-candidate scores and are exportable to CSV.",
    features: [
      "Select any combination of candidates from the pool",
      "Choose one Active JD as the benchmark",
      "Async processing — runs in the background, page auto-refreshes",
      "Per-candidate match score, gaps, and key strengths",
      "Job statuses: Pending → Running → Completed / Failed",
      "Export all results to CSV for reporting",
      "Completed jobs retained for historical comparison",
    ],
  },
  {
    num:  "09",
    title: "Talent Pool Search",
    route: "/talent-search",
    screenshot: "09-talent.jpg",
    color: C.teal,
    badge: "ENTERPRISE",
    badgeColor: C.primary,
    description:
      "Semantic full-text search across every resume in your candidate pool using TF-IDF scoring. Results are ranked by relevance with highlighted matching snippets.",
    features: [
      "Natural language or keyword queries accepted",
      "TF-IDF semantic ranking — finds the most relevant candidates",
      "Best-matching snippet extracted and highlighted per result",
      "Relevance score (0–100) shown per candidate",
      "Instant results — no separate indexing step required",
      "Returns candidate name, email, score, and a View Profile link",
      "Works across all resume text including embedded sections",
    ],
  },
  {
    num:  "10",
    title: "Skills Gap Analytics",
    route: "/analytics",
    screenshot: "10-analytics.jpg",
    color: C.purple,
    badge: "ENTERPRISE",
    badgeColor: C.primary,
    description:
      "Aggregate analytics across all analyses in your tenant. Visualise the most common skill gaps, top strengths, and score distributions to inform hiring strategy.",
    features: [
      "Top Skills Gaps — horizontal bar chart ranked by frequency",
      "Top Strengths — bar chart of the most common strong points",
      "Score Distribution — histogram across 5 score bands",
      "Section Score Radar — average per section (Experience, Skills, Education, Certifications)",
      "Filter all charts to a single Job Description",
      "Data updates live as new analyses are completed",
      "Useful for identifying hiring strategy gaps at the organisational level",
    ],
  },
  {
    num:  "11",
    title: "AI Shortlisting Agent",
    route: "/agent",
    screenshot: "11-agent.jpg",
    color: C.pink,
    badge: "ENTERPRISE",
    badgeColor: C.primary,
    description:
      "Autonomous multi-stage AI agent that ranks candidates and generates a shortlist for HR approval. Human-in-the-loop: HR must approve before action is taken.",
    features: [
      "Select a JD and set the maximum shortlist size",
      "Agent works in stages: Search → Analyse → Rank → Report → Await Approval",
      "Real-time step log shows agent reasoning for full transparency",
      "GPT-5.2 individually evaluates each candidate against the JD",
      "Ranked shortlist with per-candidate reasoning, strengths, and concerns",
      "HR approves or rejects with optional note — webhook fires on each decision",
      "Approved shortlists trigger downstream n8n workflows (e.g. Gmail outreach)",
    ],
  },
  {
    num:  "12",
    title: "Candidate Q&A (RAG)",
    route: "/rag",
    screenshot: "12-rag.jpg",
    color: C.teal,
    badge: "ENTERPRISE",
    badgeColor: C.primary,
    description:
      "Ask plain-English questions about your candidate pool. BM25 retrieves the most relevant resume sections; GPT-5.2 synthesises a cited, grounded answer.",
    features: [
      "Natural language questions — no query syntax required",
      "BM25 ranking retrieves the top resume sections per query",
      "GPT-5.2 synthesises answers from real resume content only — no hallucinations",
      "Every answer includes source citations: candidate name, section, snippet, score",
      "Conversation-style chat UI with message history",
      "Example queries: 'Who has Kubernetes experience?', 'Find candidates with a Masters degree'",
      "Resumes are chunked by section on upload for precise retrieval",
    ],
  },
  {
    num:  "13",
    title: "Position Board",
    route: "/tickets",
    screenshot: "13-tickets.jpg",
    color: C.amber,
    badge: "ENTERPRISE",
    badgeColor: C.primary,
    description:
      "7-column Kanban board for tracking every open role through the hiring pipeline. Drag and drop cards between columns to update status. SLA timers per priority level.",
    features: [
      "7 columns: Draft → Open → Sourcing → Screening → Interviewing → Offer → Closed",
      "Drag-and-drop status transitions with instant save",
      "Priority levels: Critical (14d SLA), High (30d), Medium (60d), Low (90d)",
      "SLA warning (yellow) and breach (red) badges visible on every card",
      "Ticket detail: metadata, candidate pipeline, interviews, activity feed, comments",
      "Recruiter Workload view: bar chart of ticket count per recruiter + SLA breach counts",
      "Webhooks fire on position.opened and position.closed events",
    ],
  },
  {
    num:  "14",
    title: "Interview Scheduling",
    route: "/interviews",
    screenshot: "14-interviews.jpg",
    color: C.indigo,
    badge: "ENTERPRISE",
    badgeColor: C.primary,
    description:
      "Day-grouped timeline of all interviews across every position. Schedule, complete, cancel, and record structured feedback — all from one page.",
    features: [
      "Filter pills: Upcoming / Scheduled / Completed / Cancelled / All",
      "Day-grouped timeline view — easy to scan the week ahead",
      "Schedule from ticket detail: date/time, type, duration, interviewers, link/location",
      "Interview types: Phone, Video, Technical, Onsite, Panel",
      "Add to Calendar button — RFC-5545 .ics download (Outlook / Google / Apple Calendar)",
      "Complete → opens 6-dimension feedback dialog",
      "Request Feedback → sends Teams DM to all interviewers (webhook event)",
    ],
  },
  {
    num:  "15",
    title: "Structured Interview Feedback",
    route: "/interviews",
    screenshot: "14-interviews.jpg",
    color: C.green,
    badge: "ENTERPRISE",
    badgeColor: C.primary,
    description:
      "When marking an interview complete, rate the candidate across 6 dimensions with star scores and optional comments. Computed overall rating stored per interview.",
    features: [
      "6 dimensions: Technical Skills, Communication, Problem Solving, Culture Fit, Relevant Experience, Motivation",
      "1–5 star rating per dimension with optional comment",
      "Computed overall rating — automatic average shown as you score",
      "Free-text overall summary for qualitative notes",
      "Dimension scorecard displayed inline on completed interview cards",
      "Feedback stored as structured JSON in the database",
      "Used by interviewers and HR to compare candidates across rounds",
    ],
  },
  {
    num:  "16",
    title: "Integration Hub",
    route: "/integrations",
    screenshot: "16-integrations.jpg",
    color: C.orange,
    badge: "ENTERPRISE",
    badgeColor: C.primary,
    description:
      "Configure webhook endpoints, view delivery logs, test events, and download n8n workflow templates for Teams, Outlook, and Gmail automation.",
    features: [
      "HMAC-SHA256 signed webhooks — verify authenticity of every delivery",
      "9 events: candidate.uploaded, shortlist lifecycle, bulk_job.completed, position.opened/closed, interview.scheduled, interview.feedback_requested",
      "Per-event filtering — subscribe only to events you need",
      "Delivery log: status, HTTP code, retry count, timestamp",
      "3-attempt retry with exponential backoff on failure",
      "Test-fire any event to your webhook URL on demand",
      "6 downloadable n8n templates in two categories: Shortlisting & Pipeline / Interview Scheduling",
    ],
  },
  {
    num:  "17",
    title: "Audit Log",
    route: "/audit-log",
    screenshot: "17-audit.jpg",
    color: C.red,
    badge: "ENTERPRISE",
    badgeColor: C.primary,
    description:
      "Immutable, append-only record of every significant action performed in your organisation. Provides a full compliance trail — cannot be edited or deleted.",
    features: [
      "Covers: auth events, uploads, JD changes, bulk jobs, shortlists, tickets, interviews",
      "Shows: timestamp, actor, action type, resource type/ID, and metadata",
      "Append-only — no DELETE routes exist for audit entries",
      "Chronological feed with newest entries at the top",
      "Useful for compliance, HR governance, and security audits",
      "Every enterprise action is logged automatically — no opt-in required",
    ],
  },
  {
    num:  "18",
    title: "Team Management",
    route: "/users",
    screenshot: "18-team.jpg",
    color: C.primary,
    badge: "ENTERPRISE",
    badgeColor: C.primary,
    description:
      "Invite and manage team members. Assign roles that control what each person can see and do across the platform.",
    features: [
      "View all users: name, email, role, join date",
      "Invite new users: set name, email, temporary password, and role",
      "Roles available: super_admin, hr_admin, hiring_manager, recruiter, employee",
      "super_admin: full platform access + user management",
      "hr_admin: all analyses, bulk jobs, shortlist approval, user management",
      "hiring_manager: create JDs, view analyses for their positions",
      "recruiter: run analyses, manage candidates, schedule interviews",
      "employee: upload own resume and view own analyses only",
    ],
  },
];

// ── PDF Builder ───────────────────────────────────────────────────────────────

const doc = new PDFDocument({
  size:    "A4",
  margin:  0,
  info: {
    Title:    "MatchPoint Enterprise — User Manual",
    Author:   "MatchPoint Enterprise",
    Subject:  "User Manual & Feature Reference",
    Creator:  "MatchPoint Enterprise PDF Generator",
  },
});

const stream = fs.createWriteStream(OUT_FILE);
doc.pipe(stream);

const PW = doc.page.width;   // 595
const PH = doc.page.height;  // 842

// ── Helpers ───────────────────────────────────────────────────────────────────

function addPage() { doc.addPage({ size: "A4", margin: 0 }); }

function rect(x, y, w, h, color, radius = 0) {
  doc.save().roundedRect(x, y, w, h, radius).fill(color).restore();
}

function text(str, x, y, opts = {}) {
  doc.text(str, x, y, opts);
}

function hex2rgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

// ── Cover Page ────────────────────────────────────────────────────────────────

// Gradient background (solid approximation)
rect(0, 0, PW, PH, C.primary);
rect(0, 0, PW, PH / 2, "#0d3a5c");

// Accent stripe
rect(0, PH * 0.58, PW, 4, C.teal);

// Watermark circles
doc.save().opacity(0.06).circle(PW * 0.85, PH * 0.2, 200).fill(C.teal).restore();
doc.save().opacity(0.06).circle(PW * 0.1, PH * 0.75, 140).fill(C.accent).restore();

// Logo box
const lx = PW / 2 - 36;
rect(lx, 140, 72, 72, C.teal, 16);
doc.save()
  .fillColor(C.white).fontSize(36).font(F.bold)
  .text("M", lx, 152, { width: 72, align: "center" })
  .restore();

// Title
doc.fillColor(C.white).font(F.bold).fontSize(36)
  .text("MatchPoint Enterprise", 0, 240, { width: PW, align: "center" });

doc.fillColor("rgba(255,255,255,0.75)").font(F.regular).fontSize(16)
  .text("AI-Powered Talent Intelligence Platform", 0, 290, { width: PW, align: "center" });

// Divider
rect(PW / 2 - 30, 325, 60, 3, C.teal, 2);

// Subtitle
doc.fillColor("rgba(255,255,255,0.85)").font(F.bold).fontSize(13)
  .text("User Manual & Feature Reference", 0, 345, { width: PW, align: "center" });

// Meta pills
const metaY = 390;
const metaItems = ["Version 1.0", `April 2026`, "Node.js 24", "React 19", "GPT-5.2"];
let mx = PW / 2 - (metaItems.length * 82) / 2;
for (const m of metaItems) {
  rect(mx, metaY, 78, 26, "rgba(255,255,255,0.12)", 13);
  doc.fillColor("rgba(255,255,255,0.8)").font(F.regular).fontSize(9)
    .text(m, mx, metaY + 9, { width: 78, align: "center" });
  mx += 84;
}

// Stats strip
const statsY = PH * 0.62;
rect(40, statsY, PW - 80, 110, "rgba(255,255,255,0.08)", 12);
const stats = [
  ["18", "Feature Modules"],
  ["18", "Real Screenshots"],
  ["9",  "Webhook Events"],
  ["6",  "Feedback Dimensions"],
];
const sw = (PW - 80) / stats.length;
for (let i = 0; i < stats.length; i++) {
  const sx = 40 + i * sw;
  doc.fillColor(C.teal).font(F.bold).fontSize(28)
    .text(stats[i][0], sx, statsY + 18, { width: sw, align: "center" });
  doc.fillColor("rgba(255,255,255,0.6)").font(F.regular).fontSize(9)
    .text(stats[i][1], sx, statsY + 60, { width: sw, align: "center" });
  if (i < stats.length - 1) {
    rect(40 + (i + 1) * sw - 1, statsY + 20, 1, 60, "rgba(255,255,255,0.15)");
  }
}

// Confidential footer
rect(0, PH - 50, PW, 50, "rgba(0,0,0,0.3)");
doc.fillColor("rgba(255,255,255,0.5)").font(F.regular).fontSize(9)
  .text("CONFIDENTIAL — For internal use only. Do not distribute without authorisation.", 0, PH - 30, { width: PW, align: "center" });

// ── Table of Contents ─────────────────────────────────────────────────────────

addPage();
rect(0, 0, PW, 90, C.primary);
doc.fillColor(C.white).font(F.bold).fontSize(24).text("Table of Contents", 40, 30);
doc.fillColor("rgba(255,255,255,0.6)").font(F.regular).fontSize(11).text(`${PAGES.length} feature modules covered in this manual`, 40, 62);

let ty = 100;
for (let i = 0; i < PAGES.length; i++) {
  const p = PAGES[i];
  const rowH = 38;
  const even = i % 2 === 0;

  if (even) rect(40, ty, PW - 80, rowH, "#f8fafc", 4);

  // Number circle
  doc.save().circle(62, ty + rowH / 2, 12).fill(p.color).restore();
  doc.fillColor(C.white).font(F.bold).fontSize(8).text(p.num, 56, ty + rowH / 2 - 5, { width: 12, align: "center" });

  // Badge
  rect(PW - 130, ty + 10, p.badge.length * 7 + 10, 18, p.badgeColor, 9);
  doc.fillColor(C.white).font(F.bold).fontSize(7).text(p.badge, PW - 128, ty + 15, { width: p.badge.length * 7 + 8, align: "center" });

  doc.fillColor(C.text).font(F.bold).fontSize(11).text(p.title, 82, ty + 10);
  doc.fillColor(C.muted).font(F.regular).fontSize(8.5)
    .text(p.description.substring(0, 90) + (p.description.length > 90 ? "…" : ""), 82, ty + 24,
      { width: PW - 230 });

  ty += rowH + 2;
  if (ty > PH - 60 && i < PAGES.length - 1) {
    addPage();
    ty = 50;
  }
}

// ── Feature Pages ─────────────────────────────────────────────────────────────

for (const p of PAGES) {
  addPage();

  // Header band
  rect(0, 0, PW, 80, p.color);
  doc.save().opacity(0.15).circle(PW - 60, 40, 80).fill(C.white).restore();

  // Number
  doc.fillColor("rgba(255,255,255,0.3)").font(F.bold).fontSize(52).text(p.num, PW - 110, 12);

  // Badge
  rect(40, 20, p.badge.length * 8 + 12, 20, "rgba(255,255,255,0.2)", 10);
  doc.fillColor(C.white).font(F.bold).fontSize(8)
    .text(p.badge, 46, 26, { width: p.badge.length * 8 });

  doc.fillColor(C.white).font(F.bold).fontSize(20).text(p.title, 40, 46);

  // Route pill
  rect(40, 90, 200, 18, "#f1f5f9", 9);
  doc.fillColor(C.muted).font(F.regular).fontSize(8.5)
    .text(`https://app.matchpoint.io${p.route}`, 46, 95, { width: 192 });

  // Description box
  rect(40, 115, PW - 80, 52, "#eff6ff", 6);
  rect(40, 115, 4, 52, p.color, 0);
  doc.fillColor(C.text).font(F.regular).fontSize(10)
    .text(p.description, 52, 122, { width: PW - 96, lineGap: 2 });

  let contentY = 178;

  // Screenshot (if available)
  const ssPath = p.screenshot ? path.join(SS_DIR, p.screenshot) : null;
  if (ssPath && fs.existsSync(ssPath)) {
    // Browser chrome
    rect(40, contentY, PW - 80, 20, "#f1f5f9", 0);
    // Traffic lights
    doc.save().circle(56, contentY + 10, 4).fill("#ff5f57").restore();
    doc.save().circle(70, contentY + 10, 4).fill("#febc2e").restore();
    doc.save().circle(84, contentY + 10, 4).fill("#28c840").restore();
    // URL bar
    rect(96, contentY + 5, PW - 160, 10, C.white, 5);
    doc.fillColor(C.muted).font(F.regular).fontSize(6.5)
      .text(`matchpoint.io${p.route}`, 100, contentY + 7, { width: PW - 168 });
    // Screenshot image
    doc.image(ssPath, 40, contentY + 20, { width: PW - 80, height: 280, fit: [PW - 80, 280] });
    // Frame border
    doc.rect(40, contentY, PW - 80, 300).stroke(C.border);
    contentY += 312;
  }

  // Features section
  const featuresLabel = ssPath && fs.existsSync(ssPath) ? "Key Features" : "Feature Overview";
  doc.fillColor(p.color).font(F.bold).fontSize(11).text(featuresLabel, 40, contentY);
  rect(40, contentY + 14, 32, 2, p.color, 1);
  contentY += 22;

  const colW = (PW - 80) / 2;
  const half = Math.ceil(p.features.length / 2);

  for (let i = 0; i < p.features.length; i++) {
    const col = i < half ? 0 : 1;
    const row = i < half ? i : i - half;
    const fx = 40 + col * (colW + 10);
    const fy = contentY + row * 26;

    // Bullet
    doc.save().circle(fx + 6, fy + 7, 4).fill(p.color).restore();
    doc.save().circle(fx + 6, fy + 7, 2).fill(C.white).restore();

    doc.fillColor(C.text).font(F.regular).fontSize(9.5)
      .text(p.features[i], fx + 16, fy + 1, { width: colW - 20, lineGap: 1 });
  }

  // Footer bar
  rect(0, PH - 30, PW, 30, "#f8fafc");
  rect(0, PH - 30, PW, 1, C.border);
  doc.fillColor(C.muted).font(F.regular).fontSize(8)
    .text("MatchPoint Enterprise — User Manual", 40, PH - 18);
  doc.fillColor(C.muted).font(F.regular).fontSize(8)
    .text(`${p.title}  ·  Section ${parseInt(p.num, 10)} of ${PAGES.length}`, 0, PH - 18, { width: PW - 40, align: "right" });
  doc.fillColor(p.color).font(F.bold).fontSize(8)
    .text("●", 0, PH - 18, { width: PW / 2, align: "center" });
}

// ── Finalise ──────────────────────────────────────────────────────────────────

doc.end();
await new Promise((res, rej) => stream.on("finish", res).on("error", rej));

const size = (fs.statSync(OUT_FILE).size / 1024).toFixed(1);
console.log(`\nPDF generated: ${OUT_FILE} (${size} KB)`);
console.log(`Pages: ${PAGES.length + 2} (cover + TOC + ${PAGES.length} feature pages)`);
