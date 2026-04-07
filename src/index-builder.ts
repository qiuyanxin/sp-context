import { readdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { join, relative } from "path";
import { createHash } from "crypto";
import { parseDoc, type DocLink } from "./utils/frontmatter.js";

export interface IndexEntry {
  path: string;
  title: string;
  type: string;
  project?: string;
  tags: string[];
  date?: string;
  summary: string;
  keywords: string[];   // auto-extracted keywords for better search
  contentHash: string;  // MD5 hash for dedup detection
  links?: DocLink[];
  expires?: string;
  archived?: boolean;
}

export interface Index {
  version: number;
  updated_at: string;
  entries: IndexEntry[];
}

function collectMarkdownFiles(dir: string, base: string): string[] {
  const files: string[] = [];
  if (!existsSync(dir)) return files;

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith(".")) {
      files.push(...collectMarkdownFiles(fullPath, base));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(relative(base, fullPath));
    }
  }
  return files;
}

function extractSummary(content: string, maxLen = 120): string {
  const lines = content
    .split("\n")
    .filter((l) => l.trim() && !l.startsWith("#"))
    .slice(0, 3);
  const text = lines.join(" ").trim();
  return text.length > maxLen ? text.slice(0, maxLen) + "..." : text;
}

/**
 * Extract keywords from content using TF-based ranking.
 * Extracts top N meaningful terms (filters stopwords and short tokens).
 */
export function extractKeywords(title: string, content: string, maxKeywords = 8): string[] {
  const text = `${title} ${title} ${content}`.toLowerCase(); // title weighted 2x

  // Tokenize: Latin words + CJK bigrams
  const tokens: string[] = [];
  for (const word of text.split(/[\s\-_/.,;:!?()\[\]{}'"#@&|~`^=+<>|·—–""''「」【】（）、。，：；？！]+/)) {
    if (word.length >= 2) tokens.push(word);
  }
  // CJK bigrams
  const cjkSegments = text.match(/[\u4e00-\u9fff]+/g);
  if (cjkSegments) {
    for (const seg of cjkSegments) {
      for (let i = 0; i < seg.length - 1; i++) {
        tokens.push(seg[i] + seg[i + 1]);
      }
    }
  }

  // Count frequencies
  const freq = new Map<string, number>();
  const stopwords = new Set([
    "the", "and", "for", "are", "but", "not", "you", "all", "can", "had",
    "her", "was", "one", "our", "out", "has", "have", "been", "will", "with",
    "this", "that", "from", "they", "were", "which", "their", "what", "there",
    "when", "make", "like", "than", "each", "these", "them", "then", "into",
    "some", "could", "other", "about", "more", "would", "should", "just",
    "also", "only", "after", "being", "very", "most", "even", "such",
    "的", "是", "在", "了", "和", "与", "为", "以", "及", "等", "或", "到",
    "不", "也", "就", "都", "而", "被", "让", "把", "给", "向", "从",
    "要", "会", "能", "可", "这", "那", "有", "对", "上", "下", "中",
  ]);

  for (const token of tokens) {
    if (stopwords.has(token)) continue;
    if (token.length < 2) continue;
    freq.set(token, (freq.get(token) ?? 0) + 1);
  }

  // Sort by frequency, take top N
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxKeywords)
    .map(([word]) => word);
}

function contentHash(content: string): string {
  return createHash("md5").update(content).digest("hex").slice(0, 12);
}

/** Parse any date string to epoch ms. Returns 0 for unparseable dates. */
function dateToEpoch(dateStr: string | undefined): number {
  if (!dateStr) return 0;
  const ts = new Date(dateStr).getTime();
  return Number.isNaN(ts) ? 0 : ts;
}

/** Normalize date string to ISO YYYY-MM-DD format. */
function normalizeDate(dateStr: string | undefined): string | undefined {
  if (!dateStr) return undefined;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toISOString().slice(0, 10);
}

export function buildIndex(repoPath: string): Index {
  const mdFiles = collectMarkdownFiles(repoPath, repoPath).filter(
    (f) => f !== "README.md",
  );

  const entries: IndexEntry[] = [];

  for (const filePath of mdFiles) {
    try {
      const fullPath = join(repoPath, filePath);
      const { meta, content } = parseDoc(fullPath);

      const rawContent = readFileSync(fullPath, "utf-8");

      const isArchived = meta.status === "archived";
      entries.push({
        path: filePath,
        title: meta.title || filePath,
        type: meta.type,
        project: meta.project,
        tags: meta.tags,
        date: normalizeDate(meta.date) ?? meta.date,
        summary: extractSummary(content),
        keywords: extractKeywords(meta.title || filePath, content),
        contentHash: contentHash(rawContent),
        links: meta.links,
        expires: meta.expires,
        archived: isArchived || undefined,
      });
    } catch {
      // skip files that can't be parsed
    }
  }

  entries.sort((a, b) => {
    const ta = dateToEpoch(a.date);
    const tb = dateToEpoch(b.date);
    if (ta || tb) return tb - ta;
    return a.path.localeCompare(b.path);
  });

  return {
    version: 1,
    updated_at: new Date().toISOString(),
    entries,
  };
}

export function writeIndex(repoPath: string): Index {
  const index = buildIndex(repoPath);
  writeFileSync(
    join(repoPath, "INDEX.json"),
    JSON.stringify(index, null, 2) + "\n",
  );
  return index;
}

// CLI entry point
if (import.meta.main) {
  const repoPath = process.env.SP_CONTEXT_REPO ?? join(process.env.HOME!, "sp-context");
  if (!existsSync(repoPath)) {
    console.error(`sp-context repo not found at: ${repoPath}`);
    process.exit(1);
  }
  const index = writeIndex(repoPath);
  console.log(`INDEX.json updated: ${index.entries.length} entries`);
}
