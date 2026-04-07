import { loadConfig } from "../utils/config.js";
import { remove } from "../tools/delete.js";
import { outputMessage } from "../output.js";

export async function runDelete(args: string[], repoOverride?: string): Promise<void> {
  const docPath = args[0];
  if (!docPath) {
    outputMessage("Usage: sp delete <path>\nExample: sp delete context/2026-03-30-my-doc.md");
    process.exit(2);
  }

  const config = loadConfig();
  if (repoOverride) config.repoPath = repoOverride;

  const result = await remove(config, docPath);
  outputMessage(result);
}
