import { parseArgs } from "util";
import { loadConfig } from "../utils/config.js";
import { importFromClaudeMem } from "../tools/import.js";
import { outputMessage } from "../output.js";

export async function runImport(args: string[], repoOverride?: string): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      ids: { type: "string" },
      query: { type: "string", short: "q" },
      limit: { type: "string", short: "n" },
    },
  });

  if (!values.ids && !values.query) {
    outputMessage("Usage: sp import [--ids <id1,id2>] [--query <q>] [--limit <n>]");
    process.exit(2);
  }

  const config = loadConfig();
  if (repoOverride) config.repoPath = repoOverride;

  const result = await importFromClaudeMem(config, {
    ids: values.ids ? values.ids.split(",").map(Number) : undefined,
    query: values.query,
    limit: values.limit ? parseInt(values.limit) : undefined,
  });

  outputMessage(result);
}
