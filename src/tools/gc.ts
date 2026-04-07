import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import type { SpConfig } from "../utils/config.js";
import { buildIndex, writeIndex, type IndexEntry } from "../index-builder.js";

interface GcResult {
  expired: Array<{ path: string; title: string; expires: string }>;
  archived: string[];
  message: string;
}

export function gc(config: SpConfig, autoArchive: boolean = false): GcResult {
  const index = buildIndex(config.repoPath);
  const today = new Date().toISOString().split("T")[0];

  // Find expired docs
  const expired = index.entries
    .filter(e => e.expires && e.expires < today && !e.archived)
    .map(e => ({ path: e.path, title: e.title, expires: e.expires! }));

  if (expired.length === 0) {
    return { expired: [], archived: [], message: "No expired documents found." };
  }

  const archived: string[] = [];

  if (autoArchive) {
    // For each expired doc, update its frontmatter to set status: archived
    for (const doc of expired) {
      const fullPath = join(config.repoPath, doc.path);
      try {
        let content = readFileSync(fullPath, "utf-8");

        // Check if frontmatter has status field
        if (content.match(/^---[\s\S]*?status:\s*.+[\s\S]*?---/)) {
          // Replace existing status
          content = content.replace(
            /(^---[\s\S]*?)status:\s*.+/m,
            '$1status: archived'
          );
        } else if (content.startsWith('---')) {
          // Add status before closing ---
          content = content.replace(
            /\n---/,
            '\nstatus: archived\n---'
          );
        }

        writeFileSync(fullPath, content);
        archived.push(doc.path);
      } catch {
        // skip files that can't be modified
      }
    }

    // Rebuild index after modifications
    if (archived.length > 0) {
      writeIndex(config.repoPath);
    }
  }

  const message = autoArchive
    ? `Archived ${archived.length} of ${expired.length} expired documents.`
    : `Found ${expired.length} expired documents. Use --yes to archive them.`;

  return { expired, archived, message };
}
