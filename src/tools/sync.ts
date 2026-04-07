import type { SpConfig } from "../utils/config.js";
import { createGit, pullWithTimeout } from "../utils/git.js";
import { writeIndex } from "../index-builder.js";

export async function sync(config: SpConfig): Promise<string> {
  const git = createGit(config);

  const pullResult = await pullWithTimeout(git, config);
  const index = writeIndex(config.repoPath);

  if (!pullResult.success) {
    return `Pull failed: ${pullResult.error}\nINDEX.json rebuilt from local: ${index.entries.length} entries`;
  }

  return `Synced successfully. INDEX.json rebuilt: ${index.entries.length} entries`;
}
