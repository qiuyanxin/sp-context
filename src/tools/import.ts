import { existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { Database } from "bun:sqlite";
import type { SpConfig } from "../utils/config.js";
import { push } from "./push.js";

const CLAUDE_MEM_DB = join(homedir(), ".claude-mem", "claude-mem.db");

const TYPE_MAP: Record<string, string> = {
  bugfix: "learning",
  feature: "learning",
  refactor: "learning",
  change: "reference",
  discovery: "learning",
  decision: "decision",
};

interface Observation {
  id: number;
  type: string;
  title: string;
  narrative: string;
  facts: string;
  files_modified: string;
  project: string;
  created_at_epoch: number;
}

export async function importFromClaudeMem(
  config: SpConfig,
  params: { ids?: number[]; query?: string; limit?: number },
): Promise<string> {
  if (!existsSync(CLAUDE_MEM_DB)) {
    return "claude-mem database not found at ~/.claude-mem/claude-mem.db";
  }

  const db = new Database(CLAUDE_MEM_DB, { readonly: true });

  let observations: Observation[];

  if (params.ids && params.ids.length > 0) {
    const placeholders = params.ids.map(() => "?").join(",");
    observations = db
      .query(
        `SELECT id, type, title, narrative, facts, files_modified, project, created_at_epoch
         FROM observations WHERE id IN (${placeholders}) ORDER BY created_at_epoch DESC`,
      )
      .all(...params.ids) as Observation[];
  } else if (params.query) {
    const limit = params.limit ?? 10;
    observations = db
      .query(
        `SELECT id, type, title, narrative, facts, files_modified, project, created_at_epoch
         FROM observations WHERE title LIKE ? OR narrative LIKE ?
         ORDER BY created_at_epoch DESC LIMIT ?`,
      )
      .all(`%${params.query}%`, `%${params.query}%`, limit) as Observation[];
  } else {
    db.close();
    return "Provide either observation IDs or a search query.";
  }

  db.close();

  if (observations.length === 0) {
    return "No matching observations found in claude-mem.";
  }

  const results: string[] = [];

  for (const obs of observations) {
    const spType = TYPE_MAP[obs.type] ?? "learning";
    let facts = "";
    try {
      const parsed = JSON.parse(obs.facts || "[]");
      if (Array.isArray(parsed)) {
        facts = parsed.map((f: string) => `- ${f}`).join("\n");
      }
    } catch {
      // ignore
    }

    const content = [
      obs.narrative || "",
      facts ? `\n## Key Facts\n\n${facts}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const tags = [`imported-from-claude-mem`, `cm-${obs.type}`];

    const result = await push(config, {
      title: obs.title,
      content,
      type: spType,
      project: obs.project || undefined,
      tags,
    });

    results.push(`#${obs.id}: ${result.split("\n")[0]}`);
  }

  return `Imported ${results.length} observations:\n${results.join("\n")}`;
}
