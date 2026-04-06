const SECTION_PATTERNS: Array<{ label: string; patterns: RegExp[] }> = [
  { label: "Summary",      patterns: [/\b(summary|objective|profile|about|overview)\b/i] },
  { label: "Experience",   patterns: [/\b(experience|employment|work history|career|positions?|jobs?)\b/i] },
  { label: "Skills",       patterns: [/\b(skills?|technical skills?|competenc|expertise|technologies|tools)\b/i] },
  { label: "Education",    patterns: [/\b(education|academic|degree|university|college|school|qualification)\b/i] },
  { label: "Projects",     patterns: [/\b(projects?|portfolio|open.?source|github)\b/i] },
  { label: "Certifications", patterns: [/\b(certif|license|accredit|credential)\b/i] },
  { label: "Achievements", patterns: [/\b(achievements?|awards?|honors?|recognition|accomplishments?)\b/i] },
  { label: "Languages",    patterns: [/\b(languages?|spoken|written|fluent|native)\b/i] },
];

const HEADER_LINE = /^[A-Z][A-Z\s,&/-]{2,40}:?\s*$/;
const MIN_CHUNK = 50;
const MAX_CHUNK = 1200;

interface RawSegment { label: string; lines: string[] }

function detectSectionLabel(line: string): string | null {
  const trimmed = line.trim();
  if (!HEADER_LINE.test(trimmed) && trimmed.length > 60) return null;
  for (const { label, patterns } of SECTION_PATTERNS) {
    if (patterns.some(p => p.test(trimmed))) return label;
  }
  if (HEADER_LINE.test(trimmed) && trimmed.length < 40) return trimmed.replace(/:$/, "").trim();
  return null;
}

export interface Chunk { section: string; chunkText: string }

export function chunkResume(text: string): Chunk[] {
  const lines = text.split(/\r?\n/);
  const segments: RawSegment[] = [];
  let current: RawSegment = { label: "Header", lines: [] };

  for (const line of lines) {
    const detected = detectSectionLabel(line);
    if (detected && current.lines.join(" ").trim().length >= MIN_CHUNK) {
      segments.push(current);
      current = { label: detected, lines: [] };
    } else {
      current.lines.push(line);
    }
  }
  if (current.lines.length) segments.push(current);

  const chunks: Chunk[] = [];
  for (const seg of segments) {
    const body = seg.lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
    if (body.length < MIN_CHUNK) continue;

    if (body.length <= MAX_CHUNK) {
      chunks.push({ section: seg.label, chunkText: body });
    } else {
      const paragraphs = body.split(/\n\n+/);
      let acc = "";
      for (const para of paragraphs) {
        if ((acc + "\n\n" + para).length > MAX_CHUNK && acc.length >= MIN_CHUNK) {
          chunks.push({ section: seg.label, chunkText: acc.trim() });
          acc = para;
        } else {
          acc = acc ? acc + "\n\n" + para : para;
        }
      }
      if (acc.trim().length >= MIN_CHUNK) {
        chunks.push({ section: seg.label, chunkText: acc.trim() });
      }
    }
  }

  if (chunks.length === 0) {
    const sentences = text.match(/[^.!?]{40,400}[.!?]/g) || [];
    const window = 3;
    for (let i = 0; i < sentences.length; i += window) {
      const chunk = sentences.slice(i, i + window).join(" ").trim();
      if (chunk.length >= MIN_CHUNK) chunks.push({ section: "General", chunkText: chunk });
    }
    if (chunks.length === 0 && text.trim().length >= MIN_CHUNK) {
      chunks.push({ section: "General", chunkText: text.slice(0, MAX_CHUNK).trim() });
    }
  }

  return chunks;
}
