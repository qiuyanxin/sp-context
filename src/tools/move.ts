import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "fs";
import { join, dirname, basename } from "path";
import type { SpConfig } from "../utils/config.js";
import { createGit, commitAndPush, pullWithTimeout } from "../utils/git.js";
import { writeIndex } from "../index-builder.js";

export async function move(config: SpConfig, srcPath: string, destDir: string): Promise<string> {
  const git = createGit(config);

  await pullWithTimeout(git, config);

  const absSrc = join(config.repoPath, srcPath);
  if (!existsSync(absSrc)) {
    return `Not found: ${srcPath}`;
  }

  const absDestDir = join(config.repoPath, destDir);
  if (!existsSync(absDestDir)) {
    mkdirSync(absDestDir, { recursive: true });
  }

  const fileName = basename(srcPath);
  const absDest = join(absDestDir, fileName);
  const destPath = join(destDir, fileName);

  if (existsSync(absDest)) {
    return `Target already exists: ${destPath}`;
  }

  const content = readFileSync(absSrc, "utf-8");
  writeFileSync(absDest, content);
  unlinkSync(absSrc);

  writeIndex(config.repoPath);

  try {
    await commitAndPush(git, config, [srcPath, destPath, "INDEX.json"], `move: ${srcPath} → ${destPath}`);
    return `Moved: ${srcPath} → ${destPath}\nCommitted and pushed to ${config.remoteName}/${config.defaultBranch}`;
  } catch (err) {
    try {
      await git.reset(["HEAD~1"]);
      await pullWithTimeout(git, config);
      writeIndex(config.repoPath);
      await commitAndPush(git, config, [srcPath, destPath, "INDEX.json"], `move: ${srcPath} → ${destPath}`);
      return `Moved: ${srcPath} → ${destPath} (resolved conflict)\nCommitted and pushed to ${config.remoteName}/${config.defaultBranch}`;
    } catch (retryErr) {
      return `Moved locally: ${srcPath} → ${destPath}\nPush failed: ${retryErr instanceof Error ? retryErr.message : String(retryErr)}\nRun \`sp sync\` to retry.`;
    }
  }
}
