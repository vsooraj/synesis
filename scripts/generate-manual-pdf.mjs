/**
 * MatchPoint Enterprise — User Manual PDF Generator
 * Uses Playwright to screenshot every page then generates a PDF.
 *
 * Usage:  node scripts/generate-manual-pdf.mjs
 * Output: docs/MatchPoint-Enterprise-User-Manual.pdf
 */

import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SCREENSHOTS_DIR = path.join(ROOT, "screenshots", "manual");
const PDF_OUT = path.join(ROOT, "docs", "MatchPoint-Enterprise-User-Manual.pdf");
const APP_URL = "http://localhost:25420";
const TOKEN_FILE = "/tmp/mp_token.txt";

fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
fs.mkdirSync(path.join(ROOT, "docs"), { recursive: true });

// ── Helpers ──────────────────────────────────────────────────────────────────

async function screenshot(page, name, waitFor = 1200) {
  await page.waitForTimeout(waitFor);
  const file = path.join(SCREENSHOTS_DIR, name);
  await page.screenshot({ path: file, fullPage: false });
  console.log("  captured:", name);
  return file;
}

async function injectAuth(page, token) {
  await page.addInitScript((t) => {
    localStorage.setItem("mp_token", t);
  }, token);
}

// ── Main ─────────────────────────────────────────────────────────────────────

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox"] });

let token = "";
if (fs.existsSync(TOKEN_FILE)) {
  token = fs.readFileSync(TOKEN_FILE, "utf8").trim();
}

const PAGES = [
  // [filename, url, label, needsAuth, description]
  ["01-home.jpg",         "/",              "Resume Analyzer",              false, "Paste resume and job description to get an instant AI match score."],
  ["02-login.jpg",        "/login",         "Sign In",                      false, "Secure login for enterprise users. JWT tokens valid for 7 days."],
  ["03-register.jpg",     "/register",      "Create Organisation",          false, "Register your organisation and become the Super Admin."],
  ["04-history.jpg",      "/history",       "Analysis History",             false, "View all past resume analyses in the current session."],
  ["05-stats.jpg",        "/stats",         "Platform Statistics",          false, "Aggregate match score distribution and platform-wide metrics."],
  ["06-candidates.jpg",   "/candidates",    "Candidate Pool",               true,  "Upload and manage all candidate resumes. Supports PDF upload or paste."],
  ["07-jobs.jpg",         "/jobs",          "Job Descriptions",             true,  "Create and manage job descriptions with Draft / Active / Closed status."],
  ["08-bulk.jpg",         "/bulk",          "Bulk Analysis",                true,  "Score multiple candidates against one JD in a single automated job."],
  ["09-talent.jpg",       "/talent-search", "Talent Pool Search",           true,  "Semantic TF-IDF search across all resumes with highlighted snippets."],
  ["10-analytics.jpg",    "/analytics",     "Skills Gap Analytics",         true,  "Bar charts and radar charts showing gaps, strengths, and score distribution."],
  ["11-agent.jpg",        "/agent",         "AI Shortlisting Agent",        true,  "Autonomous agent ranks candidates and creates shortlists for HR approval."],
  ["12-rag.jpg",          "/rag",           "Candidate Q&A (RAG)",          true,  "Ask plain-English questions answered with cited resume sources."],
  ["13-tickets.jpg",      "/tickets",       "Position Board",               true,  "7-column Kanban board tracking every open role from Draft to Closed."],
  ["14-interviews.jpg",   "/interviews",    "Interview Scheduling",         true,  "Day-grouped timeline of all interviews with status filter pills."],
  ["15-integrations.jpg", "/integrations",  "Integration Hub",              true,  "Webhook config, delivery log, test events, and n8n workflow templates."],
  ["16-audit.jpg",        "/audit-log",     "Audit Log",                    true,  "Immutable append-only record of every enterprise action."],
  ["17-team.jpg",         "/team",          "Team Management",              true,  "Invite team members and assign roles (super_admin → employee)."],
];

const captured = []; // { file, label, description }

// Public pages (no auth needed)
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  for (const [fname, url, label, needsAuth, desc] of PAGES) {
    if (needsAuth) continue;
    console.log(`Screenshotting ${label}...`);
    await page.goto(`${APP_URL}${url}`, { waitUntil: "networkidle" });
    const file = await screenshot(page, fname);
    captured.push({ file, label, description: desc });
  }
  await ctx.close();
}

// Authenticated pages
if (token) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await injectAuth(page, token);

  for (const [fname, url, label, needsAuth, desc] of PAGES) {
    if (!needsAuth) continue;
    console.log(`Screenshotting ${label}...`);
    await page.goto(`${APP_URL}${url}`, { waitUntil: "networkidle" });
    const file = await screenshot(page, fname);
    captured.push({ file, label, description: desc });
  }
  await ctx.close();
} else {
  console.warn("No auth token found — authenticated pages skipped.");
}

await browser.close();
console.log(`\nCaptured ${captured.length} screenshots. Building PDF...`);

// ── Build PDF from HTML ───────────────────────────────────────────────────────

// Sort captured by filename order
captured.sort((a, b) => path.basename(a.file).localeCompare(path.basename(b.file)));

// Convert images to base64 for embedding in HTML
function imgToBase64(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return "data:image/jpeg;base64," + fs.readFileSync(filePath).toString("base64");
}

const allPages = PAGES.map(([fname, , label, , desc]) => {
  const filePath = path.join(SCREENSHOTS_DIR, fname);
  return { label, description: desc, src: imgToBase64(filePath) };
});

const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #fff; color: #1a1a2e; }

  /* Cover page */
  .cover {
    width: 100%; height: 100vh; min-height: 900px;
    background: linear-gradient(135deg, #0f4c75 0%, #1b6ca8 50%, #0d7377 100%);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    page-break-after: always; color: white; text-align: center; padding: 60px;
  }
  .cover-logo { font-size: 64px; margin-bottom: 24px; }
  .cover h1 { font-size: 48px; font-weight: 800; letter-spacing: -1px; margin-bottom: 12px; }
  .cover h2 { font-size: 24px; font-weight: 300; opacity: 0.85; margin-bottom: 40px; }
  .cover-divider { width: 80px; height: 4px; background: rgba(255,255,255,0.5); border-radius: 2px; margin: 24px auto; }
  .cover-meta { font-size: 16px; opacity: 0.7; line-height: 2; }
  .cover-badge {
    display: inline-block; margin-top: 40px; padding: 10px 28px;
    border: 2px solid rgba(255,255,255,0.4); border-radius: 50px;
    font-size: 14px; letter-spacing: 2px; text-transform: uppercase; opacity: 0.8;
  }

  /* TOC */
  .toc {
    padding: 60px 72px; page-break-after: always; min-height: 900px;
  }
  .toc h2 { font-size: 32px; font-weight: 700; color: #0f4c75; margin-bottom: 8px; }
  .toc-subtitle { color: #666; margin-bottom: 40px; font-size: 15px; }
  .toc-item {
    display: flex; align-items: center; padding: 14px 0;
    border-bottom: 1px solid #f0f0f0; gap: 16px;
  }
  .toc-num {
    width: 36px; height: 36px; border-radius: 50%;
    background: #0f4c75; color: white;
    display: flex; align-items: center; justify-content: center;
    font-size: 13px; font-weight: 700; flex-shrink: 0;
  }
  .toc-name { font-size: 15px; font-weight: 600; color: #1a1a2e; }
  .toc-desc { font-size: 13px; color: #666; margin-top: 2px; }

  /* Section pages */
  .section {
    padding: 48px 60px; page-break-before: always; min-height: 900px;
  }
  .section-header {
    display: flex; align-items: center; gap: 16px; margin-bottom: 24px;
    padding-bottom: 20px; border-bottom: 3px solid #0f4c75;
  }
  .section-num {
    width: 48px; height: 48px; border-radius: 12px;
    background: linear-gradient(135deg, #0f4c75, #1b6ca8);
    color: white; display: flex; align-items: center; justify-content: center;
    font-size: 18px; font-weight: 800; flex-shrink: 0;
  }
  .section-title { font-size: 28px; font-weight: 700; color: #0f4c75; }
  .section-desc {
    font-size: 15px; color: #555; line-height: 1.6;
    margin-bottom: 28px; padding: 16px 20px;
    background: #f8fbff; border-left: 4px solid #1b6ca8; border-radius: 0 8px 8px 0;
  }
  .screenshot-frame {
    border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;
    box-shadow: 0 4px 24px rgba(0,0,0,0.08); margin-top: 8px;
  }
  .screenshot-bar {
    background: #f1f5f9; padding: 10px 16px; display: flex; align-items: center; gap: 8px;
    border-bottom: 1px solid #e2e8f0;
  }
  .dot { width: 10px; height: 10px; border-radius: 50%; }
  .dot-r { background: #ff5f57; } .dot-y { background: #febc2e; } .dot-g { background: #28c840; }
  .url-bar {
    flex: 1; background: white; border-radius: 6px; padding: 4px 12px;
    font-size: 12px; color: #666; border: 1px solid #e2e8f0; font-family: monospace;
  }
  .screenshot-frame img { width: 100%; display: block; }
  .no-screenshot {
    height: 400px; display: flex; align-items: center; justify-content: center;
    background: #f8fafc; border-radius: 0 0 12px 12px;
    flex-direction: column; gap: 12px; color: #94a3b8;
  }
  .no-screenshot svg { width: 48px; height: 48px; }
  .no-screenshot p { font-size: 15px; }

  /* Footer */
  .footer {
    margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0;
    display: flex; justify-content: space-between; align-items: center;
    font-size: 12px; color: #94a3b8;
  }
  .footer-brand { font-weight: 600; color: #1b6ca8; }

  @media print {
    .cover, .toc, .section { page-break-after: always; }
  }
</style>
</head>
<body>

<!-- COVER PAGE -->
<div class="cover">
  <div class="cover-logo">⬡</div>
  <h1>MatchPoint Enterprise</h1>
  <h2>AI-Powered Talent Intelligence Platform</h2>
  <div class="cover-divider"></div>
  <div class="cover-meta">
    User Manual &amp; Feature Reference<br>
    Version 1.0 &nbsp;·&nbsp; ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}<br>
    Node.js 24 &nbsp;·&nbsp; React 19 &nbsp;·&nbsp; GPT-5.2 &nbsp;·&nbsp; PostgreSQL
  </div>
  <div class="cover-badge">Confidential</div>
</div>

<!-- TABLE OF CONTENTS -->
<div class="toc">
  <h2>Table of Contents</h2>
  <p class="toc-subtitle">17 feature modules covered in this manual</p>
  ${allPages.map(({ label, description }, i) => `
  <div class="toc-item">
    <div class="toc-num">${String(i + 1).padStart(2, "0")}</div>
    <div>
      <div class="toc-name">${label}</div>
      <div class="toc-desc">${description}</div>
    </div>
  </div>`).join("")}
</div>

<!-- FEATURE SECTIONS -->
${allPages.map(({ label, description, src }, i) => `
<div class="section">
  <div class="section-header">
    <div class="section-num">${String(i + 1).padStart(2, "0")}</div>
    <div class="section-title">${label}</div>
  </div>
  <div class="section-desc">${description}</div>
  <div class="screenshot-frame">
    <div class="screenshot-bar">
      <div class="dot dot-r"></div>
      <div class="dot dot-y"></div>
      <div class="dot dot-g"></div>
      <div class="url-bar">https://matchpoint.yourdomain.com${getPath(label)}</div>
    </div>
    ${src
      ? `<img src="${src}" alt="${label}" />`
      : `<div class="no-screenshot">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
              d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p>Screenshot requires authentication — sign in to capture this page</p>
        </div>`
    }
  </div>
  <div class="footer">
    <span class="footer-brand">MatchPoint Enterprise</span>
    <span>${label} · Page ${i + 3} of ${allPages.length + 2}</span>
  </div>
</div>
`).join("")}

</body>
</html>`;

function getPath(label) {
  const map = {
    "Resume Analyzer": "/", "Sign In": "/login", "Create Organisation": "/register",
    "Analysis History": "/history", "Platform Statistics": "/stats",
    "Candidate Pool": "/candidates", "Job Descriptions": "/jobs",
    "Bulk Analysis": "/bulk", "Talent Pool Search": "/talent-search",
    "Skills Gap Analytics": "/analytics", "AI Shortlisting Agent": "/agent",
    "Candidate Q&A (RAG)": "/rag", "Position Board": "/tickets",
    "Interview Scheduling": "/interviews", "Integration Hub": "/integrations",
    "Audit Log": "/audit-log", "Team Management": "/team",
  };
  return map[label] || "/";
}

// Use Playwright to print HTML to PDF
const pdfBrowser = await chromium.launch({ args: ["--no-sandbox"] });
const pdfPage = await pdfBrowser.newPage();
await pdfPage.setContent(htmlContent, { waitUntil: "networkidle" });
await pdfPage.pdf({
  path: PDF_OUT,
  format: "A4",
  printBackground: true,
  margin: { top: "0", right: "0", bottom: "0", left: "0" },
});
await pdfBrowser.close();

console.log(`\nPDF generated: ${PDF_OUT}`);
