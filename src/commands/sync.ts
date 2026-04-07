import { loadConfig } from "../utils/config.js";
import { sync } from "../tools/sync.js";
import { outputMessage } from "../output.js";

export async function runSync(repoOverride?: string): Promise<void> {
  const config = loadConfig();
  if (repoOverride) config.repoPath = repoOverride;

  const result = await sync(config);
  outputMessage(result);
}
