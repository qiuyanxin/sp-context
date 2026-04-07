import { loadConfig } from "../utils/config.js";
import { init } from "../tools/init.js";
import { outputMessage } from "../output.js";

export async function runInit(args: string[], repoOverride?: string): Promise<void> {
  const config = loadConfig();
  // Allow positional arg to override repo path
  const targetPath = args[0] ?? repoOverride;
  if (targetPath) config.repoPath = targetPath;

  const result = await init(config);
  outputMessage(result);
}
