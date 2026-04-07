/**
 * Migration script: add date prefix to knowledge base files that need it.
 *
 * Rules:
 * - Skip files whose parent directory already has a date (e.g. 2026-03-18-workspace/)
 * - Skip files in deep reference/template/skill structures (references/, templates/, skills/, commands/, config/)
 * - Skip numbered files (00-xxx, 01-xxx) — these have intentional ordering
 * - For eligible files, extract date from frontmatter or file mtime, rename to YYYY-MM-DD-originalname.md
 * - Also handles the duplicate: removes research/agent-strategic-positioning.md (dup of decisions/2026-04-02-...)
 */

import { readdirSync, readFileSync, renameSync, unlinkSync, statSync, existsSync } from "fs";
import { join, basename, dirname, relative } from "path";
import matter from "gray-matter";

const REPO = process.env.SP_CONTEXT_REPO ?? join(process.env.HOME!, "sp-context");

// Directories whose children should be skipped
const SKIP_DIRS = new Set(["references", "templates", "skills", "commands", "config", "resources", "sub", "weekly"]);

interface RenameAction {
  from: string;  // relative path
  to: string;    // relative path
  reason: string;
}

function collectMarkdownFiles(dir: string, base: string): string[] {
  const files: string[] = [];
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith(".")) {
      files.push(...collectMarkdownFiles(full, base));
    } else if (entry.isFile() && entry.name.endsWith(".md") && entry.name !== "README.md") {
      files.push(relative(base, full));
    }
  }
  return files;
}

function hasDatePrefix(name: string): boolean {
  return /^\d{4}-\d{2}-\d{2}/.test(name);
}

function hasNumberPrefix(name: string): boolean {
  return /^\d{2}-/.test(name);
}

function parentHasDate(relPath: string): boolean {
  const parts = relPath.split("/");
  // Check all parent directories (not the file itself)
  for (let i = 0; i < parts.length - 1; i++) {
    if (/\d{4}-\d{2}-\d{2}/.test(parts[i])) return true;
  }
  return false;
}

function isInSkipDir(relPath: string): boolean {
  const parts = relPath.split("/");
  return parts.some(p => SKIP_DIRS.has(p));
}

function getDateFromFile(fullPath: string): string {
  try {
    const raw = readFileSync(fullPath, "utf-8");
    const { data } = matter(raw);
    if (data.date) {
      const d = new Date(data.date);
      if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
  } catch {}

  // Fallback: file mtime
  try {
    return statSync(fullPath).mtime.toISOString().slice(0, 10);
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

// ── Main ──

const allFiles = collectMarkdownFiles(REPO, REPO);
const actions: RenameAction[] = [];

// 1. Handle duplicate
const dupPath = "research/agent-strategic-positioning.md";
const dupTarget = "decisions/2026-04-02-agent-strategic-positioning.md";
if (existsSync(join(REPO, dupPath)) && existsSync(join(REPO, dupTarget))) {
  console.log(`\n🗑️  DUPLICATE: removing ${dupPath} (kept ${dupTarget})`);
  unlinkSync(join(REPO, dupPath));
}

// 2. Find files to rename
for (const relPath of allFiles) {
  const name = basename(relPath);

  // Already has date prefix
  if (hasDatePrefix(name)) continue;

  // Has intentional number ordering (00-xxx, 01-xxx)
  if (hasNumberPrefix(name)) continue;

  // Parent directory already has date
  if (parentHasDate(relPath)) continue;

  // In a skip directory (templates, references, etc.)
  if (isInSkipDir(relPath)) continue;

  // Special files (SKILL.md, etc.)
  if (name === "SKILL.md") continue;

  // This file needs a date prefix
  const fullPath = join(REPO, relPath);
  if (!existsSync(fullPath)) continue; // already deleted (e.g. duplicate)
  const date = getDateFromFile(fullPath);

  // If the filename already contains a date somewhere (e.g. exec-2026-03-09-xxx),
  // extract that date and use it as the prefix instead of doubling up
  const embeddedDate = name.match(/(\d{4}-\d{2}-\d{2})/);
  let newName: string;
  if (embeddedDate) {
    // Use the embedded date as prefix, keep the original name after it
    newName = `${embeddedDate[1]}-${name.replace(embeddedDate[0] + "-", "").replace(embeddedDate[0], "")}`;
    // Clean up double dashes
    newName = newName.replace(/--+/g, "-").replace(/-\.md$/, ".md");
  } else {
    newName = `${date}-${name}`;
  }
  const newRelPath = join(dirname(relPath), newName);

  actions.push({
    from: relPath,
    to: newRelPath,
    reason: `date from ${fullPath.includes("frontmatter") ? "frontmatter" : "file"}`,
  });
}

// 3. Preview
console.log(`\n📋 Files to rename: ${actions.length}\n`);
for (const a of actions) {
  console.log(`  ${a.from}`);
  console.log(`  → ${a.to}\n`);
}

// 4. Execute if --execute flag
if (process.argv.includes("--execute")) {
  console.log("\n🔧 Executing renames...\n");
  for (const a of actions) {
    const fromFull = join(REPO, a.from);
    const toFull = join(REPO, a.to);
    renameSync(fromFull, toFull);
    console.log(`  ✓ ${a.from} → ${basename(a.to)}`);
  }
  console.log(`\nDone! Renamed ${actions.length} files.`);
} else {
  console.log("Dry run. Pass --execute to apply renames.");
}
