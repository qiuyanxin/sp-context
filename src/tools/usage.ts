import { join } from "path";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";

export interface UsageRecord {
  read_count: number;
  last_read: string;
  search_hit_count: number;
}

export interface UsageStore {
  [path: string]: UsageRecord;
}

const USAGE_DIR = ".sp-context";
const USAGE_FILE = "usage.json";

function usagePath(repoPath: string): string {
  return join(repoPath, USAGE_DIR, USAGE_FILE);
}

export function loadUsage(repoPath: string): UsageStore {
  const p = usagePath(repoPath);
  if (!existsSync(p)) return {};
  try {
    return JSON.parse(readFileSync(p, "utf-8"));
  } catch {
    return {};
  }
}

function saveUsage(repoPath: string, store: UsageStore): void {
  const dir = join(repoPath, USAGE_DIR);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(usagePath(repoPath), JSON.stringify(store, null, 2) + "\n");
}

export function trackRead(repoPath: string, docPath: string): void {
  const store = loadUsage(repoPath);
  const record = store[docPath] || { read_count: 0, last_read: "", search_hit_count: 0 };
  record.read_count++;
  record.last_read = new Date().toISOString().split("T")[0];
  store[docPath] = record;
  saveUsage(repoPath, store);
}

export function trackSearchHit(repoPath: string, docPaths: string[]): void {
  if (docPaths.length === 0) return;
  const store = loadUsage(repoPath);
  for (const p of docPaths) {
    const record = store[p] || { read_count: 0, last_read: "", search_hit_count: 0 };
    record.search_hit_count++;
    store[p] = record;
  }
  saveUsage(repoPath, store);
}
