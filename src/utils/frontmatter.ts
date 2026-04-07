import matter from "gray-matter";
import { readFileSync, statSync } from "fs";
import { basename, dirname } from "path";

export interface DocLink {
  type: "based-on" | "leads-to" | "related";
  target: string;
  evidence?: string;
}

export interface DocMeta {
  title: string;
  type: string;
  project?: string;
  author?: string;
  date?: string;
  tags: string[];
  links?: DocLink[];
  expires?: string;
  status?: "active" | "archived" | "draft";
}

export interface ParsedDoc {
  meta: DocMeta;
  content: string;
}

function inferTitle(filePath: string, content: string): string {
  // Try first heading
  const headingMatch = content.match(/^#\s+(.+)$/m);
  if (headingMatch) return headingMatch[1].trim();

  // Fall back to filename
  return basename(filePath, ".md").replace(/[-_]/g, " ");
}

function inferType(filePath: string): string {
  const lower = filePath.toLowerCase();
  if (lower.includes("plan")) return "status";
  if (lower.includes("competitor") || lower.includes("analysis")) return "reference";
  if (lower.includes("goal") || lower.includes("task")) return "reference";
  if (lower.includes("context")) return "reference";
  if (lower.includes("decision")) return "decision";
  if (lower.includes("learning") || lower.includes("experience")) return "learning";
  if (lower.includes("meeting")) return "meeting";
  if (lower.includes("playbook") || lower.includes("sop")) return "playbook";
  if (lower.includes("client")) return "reference";
  return "reference";
}

function inferDate(filePath: string, fullPath: string): string | undefined {
  // Try date prefix in filename or parent dir (e.g. 2026-03-09-xxx)
  const dateMatch = filePath.match(/(\d{4}-\d{2}-\d{2})/);
  if (dateMatch) return dateMatch[1];

  // Fall back to file mtime
  try {
    const stat = statSync(fullPath);
    return stat.mtime.toISOString().split("T")[0];
  } catch {
    return undefined;
  }
}

function inferProject(filePath: string): string | undefined {
  // Try to extract project name from path like plans/project-xxx or clients/project-name
  const parts = filePath.split("/");
  if (parts.length >= 2) {
    const dirName = parts[1] ?? parts[0];
    const projectMatch = dirName.match(/^(?:lafe-\d{4}-\d{2}-\d{2}-)?(.+)/);
    if (projectMatch && parts[0] === "plans") {
      return projectMatch[1];
    }
  }
  return undefined;
}

export function parseDoc(filePath: string): ParsedDoc {
  const raw = readFileSync(filePath, "utf-8");
  const { data, content } = matter(raw);

  const hasFrontmatter = Object.keys(data).length > 0;
  const trimmedContent = content.trim();

  // Parse links from frontmatter
  const links: DocLink[] | undefined = Array.isArray(data.links)
    ? data.links
        .filter((l: any) => l && l.type && l.target)
        .map((l: any) => ({
          type: l.type,
          target: l.target,
          ...(l.evidence ? { evidence: l.evidence } : {}),
        }))
    : undefined;

  return {
    meta: {
      title: data.title ?? inferTitle(filePath, trimmedContent),
      type: data.type ?? inferType(filePath),
      project: data.project ?? inferProject(filePath),
      author: data.author,
      date: data.date ? String(data.date) : inferDate(filePath, filePath),
      tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
      links: links && links.length > 0 ? links : undefined,
      expires: data.expires ? String(data.expires) : undefined,
      status: data.status as DocMeta["status"] ?? undefined,
    },
    content: trimmedContent,
  };
}

export function buildFrontmatter(meta: DocMeta): string {
  const lines = ["---"];
  lines.push(`title: "${meta.title}"`);
  lines.push(`type: ${meta.type}`);
  if (meta.project) lines.push(`project: ${meta.project}`);
  if (meta.author) lines.push(`author: ${meta.author}`);
  if (meta.date) lines.push(`date: ${meta.date}`);
  if (meta.tags.length > 0) lines.push(`tags: [${meta.tags.join(", ")}]`);
  if (meta.expires) lines.push(`expires: ${meta.expires}`);
  if (meta.status) lines.push(`status: ${meta.status}`);
  if (meta.links && meta.links.length > 0) {
    lines.push("links:");
    for (const link of meta.links) {
      lines.push(`  - type: ${link.type}`);
      lines.push(`    target: ${link.target}`);
      if (link.evidence) lines.push(`    evidence: "${link.evidence}"`);
    }
  }
  lines.push("---");
  return lines.join("\n");
}
