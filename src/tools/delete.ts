import { existsSync, unlinkSync } from "fs";
import { join } from "path";
import type { SpConfig } from "../utils/config.js";
import { createGit, commitAndPush, pullWithTimeout } from "../utils/git.js";
import { writeIndex } from "../index-builder.js";

export async function remove(config: SpConfig, docPath: string): Promise<string> {
  const git = createGit(config);

  await pullWithTimeout(git, config);

  const absPath = join(config.repoPath, docPath);
  if (!existsSync(absPath)) {
    return `Not found: ${docPath}`;
  }

  unlinkSync(absPath);

  writeIndex(config.repoPath);

  try {
    await commitAndPush(git, config, [docPath, "INDEX.json"], `delete: ${docPath}`);
    return `Deleted: ${docPath}\nCommitted and pushed to ${config.remoteName}/${config.defaultBranch}`;
  } catch (err) {
    try {
      await git.reset(["HEAD~1"]);
      await pullWithTimeout(git, config);
      writeIndex(config.repoPath);
      await commitAndPush(git, config, [docPath, "INDEX.json"], `delete: ${docPath}`);
      return `Deleted: ${docPath} (resolved conflict)\nCommitted and pushed to ${config.remoteName}/${config.defaultBranch}`;
    } catch (retryErr) {
      return `Deleted locally: ${docPath}\nPush failed: ${retryErr instanceof Error ? retryErr.message : String(retryErr)}\nRun \`sp sync\` to retry.`;
    }
  }
}
