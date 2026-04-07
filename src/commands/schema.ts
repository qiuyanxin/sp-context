import { loadConfig } from "../utils/config.js";
import { schema } from "../tools/schema.js";
import { output } from "../output.js";

export function runSchema(args: string[], repoOverride?: string): void {
  const config = loadConfig();
  if (repoOverride) config.repoPath = repoOverride;

  const result = schema(config.repoPath);
  output(result);
}
