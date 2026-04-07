import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import type { SpConfig } from "../utils/config.js";
import { buildFrontmatter, type DocMeta } from "../utils/frontmatter.js";
import { createGit, commitAndPush, pullWithTimeout } from "../utils/git.js";
import { buildIndex, writeIndex } from "../index-builder.js";
import { slugify, checkDedup, correctTags, checkCascadeReview } from "../utils/doc-guards.js";

interface PushParams {
  title: string;
  content: string;
  type: string;
  project?: string;
  tags?: string[];
  dir?: string;
  ttl?: string;  // e.g., "30d", "7d"
  category?: string;  // personal sub-folder: research, drafts, notes
}

function parseTTLDays(ttl: string): number {
  const match = ttl.match(/^(\d+)d$/);
  return match ? parseInt(match[1]) : 0;
}

function resolveDir(repoPath: string, type: string, _project?: string, _category?: string): string {
  const now = new Date();
  switch (type) {
    case "reference":
      return join(repoPath, "context");
    case "decision":
      return join(repoPath, "decisions");
    case "learning":
      return join(repoPath, "experience");
    case "meeting": {
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      return join(repoPath, "meetings", String(year), month);
    }
    case "status": {
      const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      return join(repoPath, "plans", ym);
    }
    case "playbook":
      return join(repoPath, "playbook");
    case "personal": {
      const userDir = join(repoPath, "people", process.env.USER ?? "unknown");
      return _category ? join(userDir, _category) : userDir;
    }
    default:
      return join(repoPath, "context");
  }
}

export async function push(config: SpConfig, params: PushParams): Promise<string> {
  const git = createGit(config);

  // Pull before push to avoid conflicts
  await pullWithTimeout(git, config);

  // ── Dedup check ──
  const existingIndex = buildIndex(config.repoPath);
  const dedup = checkDedup(params.content, existingIndex);
  if (dedup.isDuplicate) {
    return `Skipped (duplicate detected): "${dedup.existingTitle}" at ${dedup.existingPath}\nContent hash: ${dedup.hash}`;
  }

  // ── Tag correction ──
  const tagResult = correctTags(params.tags ?? [], existingIndex);
  params.tags = tagResult.tags;
  const tagWarnings = tagResult.warnings;

  const dir = params.dir
    ? join(config.repoPath, params.dir)
    : resolveDir(config.repoPath, params.type, params.project, params.category);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const slug = slugify(params.title);
  const date = new Date().toISOString().split("T")[0];
  const fileName = `${date}-${slug}.md`;
  const filePath = join(dir, fileName);

  const meta: DocMeta = {
    title: params.title,
    type: params.type,
    project: params.project,
    author: config.defaultAuthor,
    date,
    tags: params.tags ?? [],
  };

  if (params.ttl) {
    const days = parseTTLDays(params.ttl);
    if (days > 0) {
      const expires = new Date();
      expires.setDate(expires.getDate() + days);
      meta.expires = expires.toISOString().split("T")[0];
    }
  }

  const fileContent = `${buildFrontmatter(meta)}\n\n${params.content}\n`;
  writeFileSync(filePath, fileContent);

  // Rebuild index
  writeIndex(config.repoPath);

  // ── Cascade review ──
  const relativePath = filePath.replace(config.repoPath + "/", "");
  const cascadeWarnings = checkCascadeReview(existingIndex, relativePath);

  // Collect all warnings
  const allWarnings = [...tagWarnings, ...cascadeWarnings];
  const warningBlock = allWarnings.length > 0
    ? "\n" + allWarnings.join("\n")
    : "";

  // Commit and push (retry once on conflict)
  try {
    await commitAndPush(git, config, [relativePath, "INDEX.json"], `add: ${params.title}`);
    return `Pushed: ${relativePath}\nCommitted and pushed to ${config.remoteName}/${config.defaultBranch}${warningBlock}`;
  } catch (err) {
    // Likely INDEX.json conflict — pull, rebuild, retry
    try {
      await git.reset(["HEAD~1"]);
      await pullWithTimeout(git, config);
      writeIndex(config.repoPath);
      await commitAndPush(git, config, [relativePath, "INDEX.json"], `add: ${params.title}`);
      return `Pushed: ${relativePath} (resolved conflict)\nCommitted and pushed to ${config.remoteName}/${config.defaultBranch}${warningBlock}`;
    } catch (retryErr) {
      return `Saved locally: ${relativePath}\nPush failed: ${retryErr instanceof Error ? retryErr.message : String(retryErr)}\nRun \`sp sync\` to retry.${warningBlock}`;
    }
  }
}
