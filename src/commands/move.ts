import { parseArgs } from "util";
import { loadConfig } from "../utils/config.js";
import { move } from "../tools/move.js";
import { outputMessage } from "../output.js";

export async function runMove(args: string[], repoOverride?: string): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      to: { type: "string" },
    },
    allowPositionals: true,
  });

  const srcPath = positionals[0];
  const destDir = values.to;

  if (!srcPath || !destDir) {
    outputMessage("Usage: sp move <path> --to <target-dir>\nExample: sp move context/my-doc.md --to people/qiuyanxin");
    process.exit(2);
  }

  const config = loadConfig();
  if (repoOverride) config.repoPath = repoOverride;

  const result = await move(config, srcPath, destDir);
  outputMessage(result);
}
