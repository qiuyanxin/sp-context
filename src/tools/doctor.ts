import { existsSync, readdirSync } from "fs";
import { join } from "path";
import { buildIndex, type IndexEntry } from "../index-builder.js";
import { loadUsage } from "./usage.js";

export interface Finding {
  level: "error" | "warning" | "info";
  category: string;
  message: string;
  paths?: string[];
}

export interface DoctorReport {
  findings: Finding[];
  summary: { errors: number; warnings: number; info: number };
}

const KNOWN_DIRS = [
  "context",
  "decisions",
  "experience",
  "meetings",
  "plans",
  "playbook",
  "people",
];

function checkDuplicates(entries: IndexEntry[]): Finding[] {
  const findings: Finding[] = [];
  const byHash = new Map<string, string[]>();

  for (const entry of entries) {
    if (!entry.contentHash) continue;
    const paths = byHash.get(entry.contentHash) ?? [];
    paths.push(entry.path);
    byHash.set(entry.contentHash, paths);
  }

  for (const [, paths] of byHash) {
    if (paths.length > 1) {
      findings.push({
        level: "error",
        category: "DUPLICATE",
        message: `${paths.length} entries share the same content hash`,
        paths,
      });
    }
  }

  return findings;
}

function checkTagCasing(entries: IndexEntry[]): Finding[] {
  const findings: Finding[] = [];
  const tagMap = new Map<string, Set<string>>(); // lowercase → set of original forms

  for (const entry of entries) {
    for (const tag of entry.tags) {
      const lower = tag.toLowerCase();
      const variants = tagMap.get(lower) ?? new Set();
      variants.add(tag);
      tagMap.set(lower, variants);
    }
  }

  for (const [lower, variants] of tagMap) {
    if (variants.size > 1) {
      const forms = [...variants].sort();
      findings.push({
        level: "warning",
        category: "TAG",
        message: `Tag case mismatch: ${forms.join(", ")} — suggest using "${lower}"`,
      });
    }
  }

  return findings;
}

function checkStale(entries: IndexEntry[]): Finding[] {
  const findings: Finding[] = [];
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const cutoff = thirtyDaysAgo.toISOString().split("T")[0];

  for (const entry of entries) {
    if (entry.type !== "status") continue;
    if (!entry.date) continue;
    if (entry.date < cutoff) {
      findings.push({
        level: "warning",
        category: "STALE",
        message: `Status doc "${entry.title}" has date ${entry.date} (older than 30 days)`,
        paths: [entry.path],
      });
    }
  }

  return findings;
}

function checkMissing(entries: IndexEntry[]): Finding[] {
  const findings: Finding[] = [];

  for (const entry of entries) {
    const issues: string[] = [];
    if (entry.title === entry.path) issues.push("title");
    if (!entry.type) issues.push("type");

    if (issues.length > 0) {
      findings.push({
        level: "warning",
        category: "MISSING",
        message: `Entry missing ${issues.join(", ")}: ${entry.path}`,
        paths: [entry.path],
      });
    }
  }

  return findings;
}

function checkEmptyDirs(repoPath: string): Finding[] {
  const findings: Finding[] = [];

  for (const dir of KNOWN_DIRS) {
    const dirPath = join(repoPath, dir);
    if (!existsSync(dirPath)) continue;

    const hasMd = readdirSync(dirPath, { recursive: true })
      .some((f) => String(f).endsWith(".md"));

    if (!hasMd) {
      findings.push({
        level: "info",
        category: "EMPTY",
        message: `Directory "${dir}" exists but contains no .md files`,
        paths: [dir],
      });
    }
  }

  return findings;
}

function checkBrokenLinks(entries: IndexEntry[]): Finding[] {
  const findings: Finding[] = [];
  const allPaths = new Set(entries.map((e) => e.path));

  for (const entry of entries) {
    if (!entry.links || entry.links.length === 0) continue;
    for (const link of entry.links) {
      if (!allPaths.has(link.target)) {
        findings.push({
          level: "error",
          category: "BROKEN_LINK",
          message: `"${entry.path}" links to "${link.target}" which does not exist in the index`,
          paths: [entry.path, link.target],
        });
      }
    }
  }

  return findings;
}

function checkMissingEvidence(entries: IndexEntry[]): Finding[] {
  const findings: Finding[] = [];
  for (const entry of entries) {
    if (!entry.links || entry.links.length === 0) continue;
    for (const link of entry.links) {
      if (!link.evidence) {
        findings.push({
          level: "warning",
          category: "MISSING_EVIDENCE",
          message: `"${entry.path}" → ${link.type} "${link.target}" has no evidence`,
          paths: [entry.path, link.target],
        });
      }
    }
  }
  return findings;
}

function checkUnused(repoPath: string, entries: IndexEntry[]): Finding[] {
  const findings: Finding[] = [];
  const usage = loadUsage(repoPath);
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const cutoff = thirtyDaysAgo.toISOString().split("T")[0];

  for (const entry of entries) {
    const record = usage[entry.path];
    if (!record || record.read_count === 0) {
      findings.push({
        level: "info",
        category: "UNUSED",
        message: `"${entry.title}" has never been read`,
        paths: [entry.path],
      });
      continue;
    }
    // Has reads, but none in the last 30 days
    if (record.last_read && record.last_read < cutoff) {
      findings.push({
        level: "info",
        category: "UNUSED",
        message: `"${entry.title}" has not been read in the last 30 days (last: ${record.last_read})`,
        paths: [entry.path],
      });
    }
  }

  return findings;
}

export function doctor(repoPath: string): DoctorReport {
  const index = buildIndex(repoPath);
  const entries = index.entries;

  const findings: Finding[] = [
    ...checkDuplicates(entries),
    ...checkTagCasing(entries),
    ...checkStale(entries),
    ...checkMissing(entries),
    ...checkEmptyDirs(repoPath),
    ...checkBrokenLinks(entries),
    ...checkMissingEvidence(entries),
    ...checkUnused(repoPath, entries),
  ];

  const summary = {
    errors: findings.filter((f) => f.level === "error").length,
    warnings: findings.filter((f) => f.level === "warning").length,
    info: findings.filter((f) => f.level === "info").length,
  };

  return { findings, summary };
}
