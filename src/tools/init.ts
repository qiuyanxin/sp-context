import { existsSync, mkdirSync, cpSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type { SpConfig } from "../utils/config.js";
import { createGit } from "../utils/git.js";
import { writeIndex } from "../index-builder.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_DIR = join(__dirname, "..", "..", "templates", "sp-context-init");

export async function init(config: SpConfig): Promise<string> {
  if (existsSync(join(config.repoPath, ".git"))) {
    return `sp-context repo already exists at ${config.repoPath}`;
  }

  // Create directory and copy template
  mkdirSync(config.repoPath, { recursive: true });

  if (existsSync(TEMPLATE_DIR)) {
    cpSync(TEMPLATE_DIR, config.repoPath, { recursive: true });
  } else {
    // Create minimal structure if template not found
    for (const dir of ["context", "decisions", "experience", "meetings", "plans", "playbook", "clients", "people"]) {
      mkdirSync(join(config.repoPath, dir), { recursive: true });
    }
  }

  // Initialize git
  const git = createGit(config);
  await git.init();

  // Build initial index
  writeIndex(config.repoPath);

  // Initial commit
  await git.add(".");
  await git.commit("init: sp-context repository");

  return `sp-context initialized at ${config.repoPath}\n\nNext steps:\n1. Create a GitHub repo and add remote: git remote add origin <url>\n2. Push: git push -u origin main\n3. Share the repo URL with your team`;
}
