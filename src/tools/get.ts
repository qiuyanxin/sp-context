import { existsSync } from "fs";
import { join } from "path";
import type { SpConfig } from "../utils/config.js";
import { parseDoc, type DocMeta } from "../utils/frontmatter.js";
import { trackRead } from "./usage.js";

export function get(
  config: SpConfig,
  path: string,
): { meta: DocMeta; content: string } | null {
  const fullPath = join(config.repoPath, path);
  if (!existsSync(fullPath)) return null;

  const { meta, content } = parseDoc(fullPath);

  // Track usage
  trackRead(config.repoPath, path);

  return { meta, content };
}
