/**
 * Fix broken links in frontmatter after filename renames.
 * Builds a mapping of old paths → new paths, then updates all link targets.
 */

import { readdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { join, relative, basename, dirname } from "path";
import matter from "gray-matter";

const REPO = process.env.SP_CONTEXT_REPO ?? join(process.env.HOME!, "sp-context");

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

// Build set of all current paths
const currentPaths = new Set(collectMarkdownFiles(REPO, REPO));

// Build old→new path mapping from git diff
// We'll use a simpler approach: for each broken link target, find a current path
// that matches the same filename (minus date prefix)
function stripDatePrefix(name: string): string {
  return name.replace(/^\d{4}-\d{2}-\d{2}-/, "");
}

// Build index: directory + stripped name → full current path
const pathIndex = new Map<string, string>();
for (const p of currentPaths) {
  const dir = dirname(p);
  const stripped = stripDatePrefix(basename(p));
  const key = `${dir}/${stripped}`;
  pathIndex.set(key, p);
}

/** Extract the "core" of a filename by removing all date patterns and normalizing */
function coreOf(name: string): string {
  return name
    .replace(/\.md$/, "")
    .replace(/\d{4}-\d{2}-\d{2}-?/g, "")  // remove all date patterns
    .replace(/^-+|-+$/g, "")               // trim leading/trailing dashes
    .replace(/-+/g, "-");                   // collapse multi-dashes
}

// Build secondary index: directory + core name → full current path
const coreIndex = new Map<string, string>();
for (const p of currentPaths) {
  const dir = dirname(p);
  const core = coreOf(basename(p));
  const key = `${dir}/${core}`;
  if (!coreIndex.has(key)) coreIndex.set(key, p);
}

function findNewPath(oldPath: string): string | null {
  // Direct match
  if (currentPaths.has(oldPath)) return oldPath;

  // Try same directory, stripped date prefix
  const dir = dirname(oldPath);
  const stripped = stripDatePrefix(basename(oldPath));
  const key = `${dir}/${stripped}`;
  const found = pathIndex.get(key);
  if (found) return found;

  // Try core name match (handles date-in-middle → date-as-prefix renames)
  const core = coreOf(basename(oldPath));
  const coreKey = `${dir}/${core}`;
  const coreFound = coreIndex.get(coreKey);
  if (coreFound) return coreFound;

  return null;
}

// Scan all files and fix link targets
let totalFixed = 0;
const allFiles = collectMarkdownFiles(REPO, REPO);

for (const relPath of allFiles) {
  const fullPath = join(REPO, relPath);
  const raw = readFileSync(fullPath, "utf-8");
  const { data, content } = matter(raw);

  if (!Array.isArray(data.links) || data.links.length === 0) continue;

  let changed = false;
  for (const link of data.links) {
    if (!link.target) continue;
    if (currentPaths.has(link.target)) continue; // link is fine

    const newTarget = findNewPath(link.target);
    if (newTarget && newTarget !== link.target) {
      console.log(`  ${relPath}: ${link.target} → ${newTarget}`);
      link.target = newTarget;
      changed = true;
      totalFixed++;
    }
  }

  if (changed) {
    // Rewrite file with updated frontmatter
    const updated = matter.stringify(content, data);
    writeFileSync(fullPath, updated);
  }
}

console.log(`\nFixed ${totalFixed} broken link targets.`);
