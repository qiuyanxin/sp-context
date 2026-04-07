import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";

export interface RepoConfig {
  path: string;
  remoteName: string;
  defaultBranch: string;
  label: string;
}

export interface SpConfig {
  repoPath: string;
  remoteName: string;
  defaultBranch: string;
  autoPull: boolean;
  pullTimeout: number;
  defaultAuthor: string;
  repos: RepoConfig[];
  activeRepo: string;
}

const CONFIG_DIR = join(homedir(), ".sp-context");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

const DEFAULT_REPO_PATH = join(homedir(), "sp-context");

const DEFAULTS: SpConfig = {
  repoPath: DEFAULT_REPO_PATH,
  remoteName: "origin",
  defaultBranch: "main",
  autoPull: true,
  pullTimeout: 3000,
  defaultAuthor: process.env.USER ?? "unknown",
  repos: [
    {
      path: DEFAULT_REPO_PATH,
      remoteName: "origin",
      defaultBranch: "main",
      label: "default",
    },
  ],
  activeRepo: "default",
};

export function loadConfig(): SpConfig {
  const envRepo = process.env.SP_CONTEXT_REPO;

  let config = { ...DEFAULTS };

  if (existsSync(CONFIG_FILE)) {
    const raw = JSON.parse(readFileSync(CONFIG_FILE, "utf-8"));
    config = { ...DEFAULTS, ...raw };
  }

  // Env var overrides active repo path
  if (envRepo) {
    config.repoPath = envRepo;
  } else {
    // Resolve active repo
    const active = config.repos.find((r) => r.label === config.activeRepo);
    if (active) {
      config.repoPath = active.path;
      config.remoteName = active.remoteName;
      config.defaultBranch = active.defaultBranch;
    }
  }

  return config;
}

export function saveConfig(config: SpConfig): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
  const { repoPath: _, ...toSave } = config;
  writeFileSync(CONFIG_FILE, JSON.stringify(toSave, null, 2) + "\n");
}

export function addRepo(
  config: SpConfig,
  label: string,
  path: string,
  remoteName = "origin",
  defaultBranch = "main",
): SpConfig {
  const existing = config.repos.findIndex((r) => r.label === label);
  const repo: RepoConfig = { path, remoteName, defaultBranch, label };

  if (existing >= 0) {
    config.repos[existing] = repo;
  } else {
    config.repos.push(repo);
  }

  return config;
}

export function switchRepo(config: SpConfig, label: string): SpConfig | null {
  const repo = config.repos.find((r) => r.label === label);
  if (!repo) return null;

  config.activeRepo = label;
  config.repoPath = repo.path;
  config.remoteName = repo.remoteName;
  config.defaultBranch = repo.defaultBranch;
  return config;
}

export function listRepos(config: SpConfig): RepoConfig[] {
  return config.repos;
}

export function getIndexPath(config: SpConfig): string {
  return join(config.repoPath, "INDEX.json");
}
