import { buildIndex } from "../index-builder.js";
import { loadUsage } from "./usage.js";

export interface SchemaOutput {
  types: string[];
  categories: string[];
  tags: Record<string, number>;
  stats: {
    total: number;
    by_type: Record<string, number>;
    by_category: Record<string, number>;
    stale_count: number;
    duplicate_count: number;
    oldest: string;
    newest: string;
  };
  top_used?: Array<{ path: string; title: string; read_count: number }>;
  least_used?: Array<{ path: string; title: string; read_count: number }>;
}

export function schema(repoPath: string): SchemaOutput {
  const index = buildIndex(repoPath);
  const entries = index.entries;

  const types = ["reference", "learning", "decision", "meeting", "status", "playbook", "personal"];
  const categories = ["context", "decisions", "experience", "meetings", "plans", "playbook", "people"];

  // Tags: count occurrences across all entries, sort by count desc
  const tagCounts = new Map<string, number>();
  for (const e of entries) {
    for (const tag of e.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }
  const tags: Record<string, number> = {};
  for (const [tag, count] of [...tagCounts.entries()].sort((a, b) => b[1] - a[1])) {
    tags[tag] = count;
  }

  // by_type: count entries per type
  const byType: Record<string, number> = {};
  for (const e of entries) {
    byType[e.type] = (byType[e.type] ?? 0) + 1;
  }

  // by_category: count entries per top-level directory
  const byCategory: Record<string, number> = {};
  for (const e of entries) {
    const firstSegment = e.path.split("/")[0];
    byCategory[firstSegment] = (byCategory[firstSegment] ?? 0) + 1;
  }

  // stale_count: status-type entries with date > 30 days ago
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split("T")[0];
  let staleCount = 0;
  for (const e of entries) {
    if (e.type === "status" && e.date && e.date < thirtyDaysAgoStr) {
      staleCount++;
    }
  }

  // duplicate_count: entries that share a contentHash with another entry
  const hashCounts = new Map<string, number>();
  for (const e of entries) {
    hashCounts.set(e.contentHash, (hashCounts.get(e.contentHash) ?? 0) + 1);
  }
  let duplicateCount = 0;
  for (const [, count] of hashCounts) {
    if (count > 1) {
      duplicateCount += count;
    }
  }

  // oldest / newest dates
  const dates = entries.filter((e) => e.date).map((e) => e.date!);
  const oldest = dates.length > 0 ? dates.reduce((a, b) => (a < b ? a : b)) : "";
  const newest = dates.length > 0 ? dates.reduce((a, b) => (a > b ? a : b)) : "";

  // Usage data
  const usage = loadUsage(repoPath);
  const hasUsage = Object.keys(usage).length > 0;

  let topUsed: SchemaOutput["top_used"];
  let leastUsed: SchemaOutput["least_used"];

  if (hasUsage) {
    // Build a title lookup from entries
    const titleMap = new Map<string, string>();
    for (const e of entries) {
      titleMap.set(e.path, e.title);
    }

    // Build usage list with titles (only entries that exist in the index)
    const usageList = Object.entries(usage)
      .filter(([path]) => titleMap.has(path))
      .map(([path, record]) => ({
        path,
        title: titleMap.get(path)!,
        read_count: record.read_count,
      }));

    // Top 10 by read_count desc
    topUsed = [...usageList]
      .sort((a, b) => b.read_count - a.read_count)
      .slice(0, 10);

    // Bottom 10 by read_count asc (include entries with no usage record)
    const allEntryUsage = entries.map((e) => ({
      path: e.path,
      title: e.title,
      read_count: usage[e.path]?.read_count ?? 0,
    }));
    leastUsed = allEntryUsage
      .sort((a, b) => a.read_count - b.read_count)
      .slice(0, 10);
  }

  return {
    types,
    categories,
    tags,
    stats: {
      total: entries.length,
      by_type: byType,
      by_category: byCategory,
      stale_count: staleCount,
      duplicate_count: duplicateCount,
      oldest,
      newest,
    },
    top_used: topUsed,
    least_used: leastUsed,
  };
}
