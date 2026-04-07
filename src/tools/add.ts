import { existsSync, readFileSync, copyFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from "fs";
import { join, basename, relative, extname } from "path";
import type { SpConfig } from "../utils/config.js";
import { parseDoc, buildFrontmatter, type DocMeta } from "../utils/frontmatter.js";
import { createGit, commitAndPush, pullWithTimeout } from "../utils/git.js";
import { buildIndex, writeIndex, extractKeywords } from "../index-builder.js";
import { datePrefixedName, checkDedup, correctTags, checkCascadeReview } from "../utils/doc-guards.js";

interface AddSuggestion {
  source: string;
  target: string;
  title: string;
  type: string;
  reason: string;
}

const TYPE_DIR_MAP: Record<string, string> = {
  reference: "context",
  decision: "decisions",
  learning: "experience",
  meeting: "meetings",
  status: "plans",
  playbook: "playbook",
  personal: "people",
};

function inferTypeFromContent(filePath: string, content: string): string {
  const lower = (filePath + " " + content.slice(0, 500)).toLowerCase();
  if (lower.includes("decision") || lower.includes("决策")) return "decision";
  if (lower.includes("meeting") || lower.includes("会议") || lower.includes("standup")) return "meeting";
  if (lower.includes("plan") || lower.includes("计划") || lower.includes("roadmap")) return "status";
  if (lower.includes("sop") || lower.includes("playbook") || lower.includes("workflow") || lower.includes("流程")) return "playbook";
  if (lower.includes("pitfall") || lower.includes("lesson") || lower.includes("踩坑") || lower.includes("经验")) return "learning";
  if (lower.includes("competitor") || lower.includes("竞品") || lower.includes("analysis")) return "reference";
  return "reference";
}

function inferTitle(filePath: string, content: string): string {
  const headingMatch = content.match(/^#\s+(.+)$/m);
  if (headingMatch) return headingMatch[1].trim();
  return basename(filePath, extname(filePath)).replace(/[-_]/g, " ");
}

function inferProjectFromTarget(target: string): string | undefined {
  const parts = target.split("/");
  if (parts.length >= 2 && parts[0] === "plans") {
    const dirName = parts[1];
    const match = dirName.match(/^(?:lafe-\d{4}-\d{2}-\d{2}-)?(.+)/);
    if (match) return match[1];
  }
  if (parts.length >= 2 && parts[0] === "product-analysis") {
    return parts[1];
  }
  return undefined;
}

function inferDateFromFile(filePath: string): string | undefined {
  const dateMatch = filePath.match(/(\d{4}-\d{2}-\d{2})/);
  if (dateMatch) return dateMatch[1];
  try {
    return statSync(filePath).mtime.toISOString().split("T")[0];
  } catch {
    return undefined;
  }
}

function suggestTarget(repoPath: string, sourcePath: string, content: string): AddSuggestion {
  const originalName = basename(sourcePath);
  const title = inferTitle(sourcePath, content);
  const type = inferTypeFromContent(sourcePath, content);
  const dir = TYPE_DIR_MAP[type] ?? "context";

  let targetDir: string;
  let reason: string;

  if (type === "meeting") {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    targetDir = `meetings/${y}/${m}`;
    reason = `内容包含会议相关关键词，归入 ${targetDir}`;
  } else if (type === "status") {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    targetDir = `plans/${ym}`;
    reason = `内容包含计划/规划关键词，归入 ${targetDir}`;
  } else {
    targetDir = dir;
    reason = `根据内容推断类型为 ${type}，归入 ${targetDir}/`;
  }

  // Use date-prefixed filename (preserves existing date prefix if present)
  const targetName = originalName.endsWith(".md")
    ? datePrefixedName(title, originalName)
    : originalName;

  return {
    source: sourcePath,
    target: join(targetDir, targetName),
    title,
    type,
    reason,
  };
}

/** Suggest target paths for files without actually copying */
export function suggestAdd(
  config: SpConfig,
  sourcePaths: string[],
): AddSuggestion[] {
  const suggestions: AddSuggestion[] = [];

  for (const sourcePath of sourcePaths) {
    if (!existsSync(sourcePath)) continue;

    const stat = statSync(sourcePath);
    if (stat.isDirectory()) {
      // Recursively collect files
      const files = collectFiles(sourcePath);
      for (const file of files) {
        const content = readFileSync(file, "utf-8");
        suggestions.push(suggestTarget(config.repoPath, file, content));
      }
    } else {
      const content = readFileSync(sourcePath, "utf-8");
      suggestions.push(suggestTarget(config.repoPath, sourcePath, content));
    }
  }

  return suggestions;
}

/** Execute the add: copy files to repo, rebuild index, commit + push */
export async function executeAdd(
  config: SpConfig,
  items: Array<{ source: string; target: string }>,
): Promise<string> {
  const git = createGit(config);
  await pullWithTimeout(git, config);

  // Build index once for dedup/tag/cascade checks
  const existingIndex = buildIndex(config.repoPath);

  const added: string[] = [];
  const skipped: string[] = [];
  const allWarnings: string[] = [];

  for (const { source, target } of items) {
    // ── Dedup check ──
    if (source.endsWith(".md")) {
      const raw = readFileSync(source, "utf-8");
      const dedup = checkDedup(raw, existingIndex);
      if (dedup.isDuplicate) {
        skipped.push(`${basename(source)} (duplicate of "${dedup.existingTitle}" at ${dedup.existingPath})`);
        continue;
      }
    }

    const targetFull = join(config.repoPath, target);
    const targetDir = join(targetFull, "..");
    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true });
    }

    // Inject or complete frontmatter for .md files
    if (source.endsWith(".md")) {
      const raw = readFileSync(source, "utf-8");
      const hasFrontmatter = raw.trimStart().startsWith("---");

      if (!hasFrontmatter) {
        // No frontmatter at all — generate full frontmatter
        const suggestion = suggestTarget(config.repoPath, source, raw);
        let tags = extractKeywords(suggestion.title, raw, 5);
        // ── Tag correction ──
        const tagResult = correctTags(tags, existingIndex);
        tags = tagResult.tags;
        allWarnings.push(...tagResult.warnings);

        const meta: DocMeta = {
          title: suggestion.title,
          type: suggestion.type,
          project: inferProjectFromTarget(target),
          author: config.defaultAuthor,
          date: inferDateFromFile(source) ?? new Date().toISOString().split("T")[0],
          tags,
          status: "active",
        };
        writeFileSync(targetFull, `${buildFrontmatter(meta)}\n\n${raw}`);
      } else {
        // Has frontmatter — fill in missing fields
        const { meta, content } = parseDoc(source);
        let patched = false;
        if (!meta.author) { meta.author = config.defaultAuthor; patched = true; }
        if (!meta.date) { meta.date = inferDateFromFile(source) ?? new Date().toISOString().split("T")[0]; patched = true; }
        if (!meta.project) { const p = inferProjectFromTarget(target); if (p) { meta.project = p; patched = true; } }
        if (meta.tags.length === 0) { meta.tags = extractKeywords(meta.title, content, 5); patched = true; }
        if (!meta.status) { meta.status = "active"; patched = true; }

        // ── Tag correction ──
        const tagResult = correctTags(meta.tags, existingIndex);
        if (tagResult.warnings.length > 0) {
          meta.tags = tagResult.tags;
          allWarnings.push(...tagResult.warnings);
          patched = true;
        }

        if (patched) {
          writeFileSync(targetFull, `${buildFrontmatter(meta)}\n\n${content}\n`);
        } else {
          copyFileSync(source, targetFull);
        }
      }
    } else {
      copyFileSync(source, targetFull);
    }

    // ── Cascade review ──
    const cascadeWarnings = checkCascadeReview(existingIndex, target);
    allWarnings.push(...cascadeWarnings);

    added.push(target);
  }

  writeIndex(config.repoPath);

  // Build result message
  const parts: string[] = [];
  if (added.length > 0) {
    parts.push(`Added ${added.length} file(s):\n${added.map((f) => `  ${f}`).join("\n")}`);
  }
  if (skipped.length > 0) {
    parts.push(`Skipped ${skipped.length} duplicate(s):\n${skipped.map((s) => `  ${s}`).join("\n")}`);
  }
  const warningBlock = allWarnings.length > 0 ? "\n" + allWarnings.join("\n") : "";

  if (added.length === 0) {
    return parts.join("\n") + warningBlock;
  }

  try {
    await commitAndPush(git, config, [...added, "INDEX.json"], `add: ${added.length} file(s)`);
    return parts.join("\n") + "\nCommitted and pushed." + warningBlock;
  } catch (err) {
    return parts.join("\n") + `\nPush failed: ${err instanceof Error ? err.message : String(err)}\nRun \`sp sync\` to retry.` + warningBlock;
  }
}

function collectFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith(".")) {
      files.push(...collectFiles(full));
    } else if (entry.isFile() && !entry.name.startsWith(".")) {
      files.push(full);
    }
  }
  return files;
}
