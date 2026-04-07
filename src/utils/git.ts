import simpleGit, { type SimpleGit } from "simple-git";
import type { SpConfig } from "./config.js";

export function createGit(config: SpConfig): SimpleGit {
  return simpleGit(config.repoPath);
}

export async function pullWithTimeout(
  git: SimpleGit,
  config: SpConfig,
): Promise<{ success: boolean; error?: string }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      config.pullTimeout,
    );

    await git.pull(config.remoteName, config.defaultBranch, {
      "--rebase": null,
    });

    clearTimeout(timeout);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function commitAndPush(
  git: SimpleGit,
  config: SpConfig,
  files: string[],
  message: string,
): Promise<void> {
  await git.add(files);
  await git.commit(message);
  await git.push(config.remoteName, config.defaultBranch);
}
