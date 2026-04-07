import { readFileSync, existsSync } from "fs";
import { join } from "path";
import MiniSearch from "minisearch";
import { getIndexPath, type SpConfig } from "../utils/config.js";
import type { Index, IndexEntry } from "../index-builder.js";
import { trackSearchHit } from "./usage.js";

interface SearchParams {
  query: string;
  type?: string;
  project?: string;
  tags?: string[];
  limit?: number;
  mode?: "and" | "or";   // default "and"
  snippet?: boolean;      // return keyword context
}

export interface SearchResult extends IndexEntry {
  snippet?: string;
  linked?: Array<{ type: string; path: string; title: string }>;
}

// ── Index loading & caching ──────────────────────────────────

let cachedIndex: Index | null = null;
let cachedIndexPath: string = "";
let cachedIndexMtime: number = 0;

function loadIndex(config: SpConfig): Index {
  const indexPath = getIndexPath(config);
  if (!existsSync(indexPath)) {
    return { version: 1, updated_at: "", entries: [] };
  }

  // Cache INDEX.json — only re-read if file changed
  try {
    const { mtimeMs } = Bun.file(indexPath);
    if (cachedIndex && cachedIndexPath === indexPath && cachedIndexMtime === mtimeMs) {
      return cachedIndex;
    }
    cachedIndex = JSON.parse(readFileSync(indexPath, "utf-8"));
    cachedIndexPath = indexPath;
    cachedIndexMtime = mtimeMs;
    miniSearchInstance = null; // invalidate search index
    return cachedIndex!;
  } catch {
    return JSON.parse(readFileSync(indexPath, "utf-8"));
  }
}

// ── MiniSearch engine (BM25 + field boosting) ────────────────

let miniSearchInstance: MiniSearch | null = null;

function buildSearchEngine(entries: IndexEntry[]): MiniSearch {
  if (miniSearchInstance) return miniSearchInstance;

  const ms = new MiniSearch<IndexEntry & { id: string; tagsText: string; keywordsText: string }>({
    fields: ["title", "summary", "tagsText", "keywordsText", "path", "project"],
    storeFields: ["path"],
    idField: "id",
    searchOptions: {
      boost: { title: 5, tagsText: 3, keywordsText: 2.5, project: 2, summary: 1.5, path: 1 },
      prefix: true,        // "pay" matches "payment"
      fuzzy: 0.2,          // typo tolerance (20% edit distance)
      combineWith: "AND",  // all keywords must match
    },
    // CJK tokenizer: split on whitespace + CJK character boundaries
    tokenize: (text) => {
      const tokens: string[] = [];
      // Standard word tokenization
      for (const word of text.toLowerCase().split(/[\s\-_/.,;:!?()\[\]{}'"#@&|~`^=+<>]+/)) {
        if (word) tokens.push(word);
      }
      // CJK bigram tokenization for Chinese/Japanese/Korean
      const cjkMatches = text.match(/[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]+/g);
      if (cjkMatches) {
        for (const segment of cjkMatches) {
          // Unigrams
          for (const char of segment) {
            tokens.push(char);
          }
          // Bigrams for better phrase matching
          for (let i = 0; i < segment.length - 1; i++) {
            tokens.push(segment[i] + segment[i + 1]);
          }
        }
      }
      return tokens;
    },
    processTerm: (term) => term.toLowerCase(),
  });

  const docs = entries.map((e, i) => ({
    ...e,
    id: `${i}`,
    tagsText: e.tags.join(" "),
    keywordsText: (e.keywords ?? []).join(" "),
    project: e.project ?? "",
  }));

  ms.addAll(docs);
  miniSearchInstance = ms;
  return ms;
}

// ── Fulltext fallback ────────────────────────────────────────

function fulltextSearch(
  config: SpConfig,
  query: string,
  excludePaths: Set<string>,
  candidates: IndexEntry[],
  limit: number,
): Array<{ entry: IndexEntry; score: number }> {
  const results: Array<{ entry: IndexEntry; score: number }> = [];
  const keywords = query.toLowerCase().split(/\s+/).filter(Boolean);

  for (const entry of candidates) {
    if (excludePaths.has(entry.path)) continue;

    const fullPath = join(config.repoPath, entry.path);
    if (!existsSync(fullPath)) continue;

    try {
      const content = readFileSync(fullPath, "utf-8").toLowerCase();
      const allFound = keywords.every((kw) => content.includes(kw));
      if (allFound) {
        // Simple TF scoring: count keyword occurrences
        let score = 0;
        for (const kw of keywords) {
          let idx = 0;
          let count = 0;
          while ((idx = content.indexOf(kw, idx)) !== -1) {
            count++;
            idx += kw.length;
          }
          score += count;
        }
        results.push({ entry, score: score * 0.1 }); // lower weight than index matches
        if (results.length >= limit) break;
      }
    } catch {
      // skip unreadable files
    }
  }

  return results;
}

// ── Snippet extraction ──────────────────────────────────────

function extractSnippet(config: SpConfig, entry: IndexEntry, query: string): string | undefined {
  const fullPath = join(config.repoPath, entry.path);
  if (!existsSync(fullPath)) return undefined;
  const content = readFileSync(fullPath, "utf-8");
  const lines = content.split('\n');
  const queryTerms = query.toLowerCase().split(/\s+/);
  for (let i = 0; i < lines.length; i++) {
    if (queryTerms.some(t => lines[i].toLowerCase().includes(t))) {
      const start = Math.max(0, i - 2);
      const end = Math.min(lines.length, i + 3);
      return lines.slice(start, end).join('\n');
    }
  }
  return undefined;
}

// ── Main search function ─────────────────────────────────────

export function search(config: SpConfig, params: SearchParams): SearchResult[] {
  const index = loadIndex(config);
  const limit = params.limit ?? 10;

  // Pre-filter by type/project/tags
  let candidates = index.entries;

  // Exclude archived docs
  candidates = candidates.filter(e => !e.archived);

  if (params.type) {
    candidates = candidates.filter((e) => e.type === params.type);
  }

  if (params.project) {
    candidates = candidates.filter((e) => e.project === params.project);
  }

  if (params.tags && params.tags.length > 0) {
    candidates = candidates.filter((e) =>
      params.tags!.some((t) => e.tags.includes(t)),
    );
  }

  // No query → sort by date descending and return
  if (!params.query) {
    const sorted = [...candidates].sort((a, b) => {
      const ta = a.date ? new Date(a.date).getTime() : 0;
      const tb = b.date ? new Date(b.date).getTime() : 0;
      return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
    });
    return sorted.slice(0, limit);
  }

  // Build MiniSearch engine over full index, then intersect with candidates
  const engine = buildSearchEngine(index.entries);
  const searchResults = engine.search(params.query, {
    combineWith: params.mode === 'or' ? 'OR' : 'AND',
  });

  // Map results back to IndexEntry, respecting pre-filters
  const candidatePaths = new Set(candidates.map((e) => e.path));
  const entryByPath = new Map(index.entries.map((e) => [e.path, e]));

  const scored: Array<{ entry: IndexEntry; score: number }> = [];

  for (const result of searchResults) {
    const entry = entryByPath.get(index.entries[parseInt(result.id)].path);
    if (entry && candidatePaths.has(entry.path)) {
      scored.push({ entry, score: result.score });
    }
  }

  // Fulltext fallback if insufficient results
  if (scored.length < limit) {
    const foundPaths = new Set(scored.map((s) => s.entry.path));
    const extra = fulltextSearch(config, params.query, foundPaths, candidates, limit - scored.length);
    scored.push(...extra);
  }

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  const finalEntries = scored.slice(0, limit).map((s) => s.entry);

  // Enrich results with snippet and linked doc titles
  const results: SearchResult[] = finalEntries.map((entry) => {
    const result: SearchResult = { ...entry };

    // Extract snippet if requested
    if (params.snippet) {
      result.snippet = extractSnippet(config, entry, params.query);
    }

    // Resolve linked doc titles
    if (entry.links && entry.links.length > 0) {
      result.linked = entry.links.map((link) => {
        const linkedEntry = entryByPath.get(link.target);
        return {
          type: link.type,
          path: link.target,
          title: linkedEntry?.title ?? link.target,
          ...(link.evidence ? { evidence: link.evidence } : {}),
        };
      });
    }

    return result;
  });

  // Track search hits
  trackSearchHit(config.repoPath, results.map(r => r.path));

  return results;
}

export { loadIndex };
