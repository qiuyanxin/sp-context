/**
 * Shared document guards: dedup, tag correction, cascade review, slugify.
 * Used by both `push` and `add` commands.
 */

import { createHash } from "crypto";
import type { Index } from "../index-builder.js";

// ── Slugify ──

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// ── Date-prefixed filename ──

/** Generate `YYYY-MM-DD-slug.md`. If filename already has a date prefix, keep it. */
export function datePrefixedName(title: string, fileName?: string): string {
  const date = new Date().toISOString().split("T")[0];

  // If the original filename already starts with a date, keep it
  if (fileName && /^\d{4}-\d{2}-\d{2}/.test(fileName)) {
    return fileName;
  }

  const slug = slugify(title);
  return `${date}-${slug}.md`;
}

// ── Content-hash dedup ──

export function contentHash(content: string): string {
  return createHash("md5").update(content).digest("hex").slice(0, 12);
}

export interface DedupResult {
  isDuplicate: boolean;
  existingPath?: string;
  existingTitle?: string;
  hash: string;
}

export function checkDedup(content: string, index: Index): DedupResult {
  const hash = contentHash(content);
  const dup = index.entries.find((e) => e.contentHash === hash);
  if (dup) {
    return { isDuplicate: true, existingPath: dup.path, existingTitle: dup.title, hash };
  }
  return { isDuplicate: false, hash };
}

// ── Tag correction: lowercase + Levenshtein merge ──

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

export interface TagCorrectionResult {
  tags: string[];
  warnings: string[];
}

export function correctTags(tags: string[], index: Index): TagCorrectionResult {
  const existingTags = new Set<string>();
  for (const entry of index.entries) {
    for (const tag of entry.tags) {
      existingTags.add(tag.toLowerCase());
    }
  }

  const warnings: string[] = [];
  const corrected = tags.map((t) => t.toLowerCase());

  for (let i = 0; i < corrected.length; i++) {
    const tag = corrected[i];
    for (const existing of existingTags) {
      if (existing !== tag && levenshtein(existing, tag) <= 2) {
        warnings.push(`Tag "${tag}" similar to existing "${existing}", auto-replaced`);
        corrected[i] = existing;
        break;
      }
    }
  }

  return { tags: corrected, warnings };
}

// ── Cascade review ──

export function checkCascadeReview(index: Index, updatedPath: string): string[] {
  const warnings: string[] = [];
  for (const entry of index.entries) {
    if (!entry.links) continue;
    for (const link of entry.links) {
      if (link.type === "based-on" && link.target === updatedPath) {
        warnings.push(`[CASCADE] ${entry.path} (based-on: ${updatedPath}) may need review`);
      }
    }
  }
  return warnings;
}
