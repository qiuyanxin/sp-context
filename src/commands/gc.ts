import { parseArgs } from "util";
import { loadConfig } from "../utils/config.js";
import { gc } from "../tools/gc.js";
import { output, outputMessage, useJson } from "../output.js";

export function runGc(args: string[], repoOverride?: string): void {
  const { values } = parseArgs({
    args,
    options: {
      yes: { type: "boolean", short: "y" },
    },
  });

  const config = loadConfig();
  if (repoOverride) config.repoPath = repoOverride;

  const result = gc(config, values.yes ?? false);

  if (useJson()) {
    output(result);
    return;
  }

  if (result.expired.length === 0) {
    outputMessage(result.message);
    return;
  }

  console.log("Expired documents:");
  for (const doc of result.expired) {
    const status = result.archived.includes(doc.path) ? " ✓ archived" : "";
    console.log(`  ${doc.path} (expired: ${doc.expires})${status}`);
  }
  console.log();
  outputMessage(result.message);
}
