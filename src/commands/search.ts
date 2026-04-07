import { parseArgs } from "util";
import { loadConfig } from "../utils/config.js";
import { search } from "../tools/search.js";
import { output, outputMessage } from "../output.js";

export function runSearch(args: string[], repoOverride?: string): void {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      type: { type: "string", short: "t" },
      project: { type: "string", short: "p" },
      tags: { type: "string" },
      limit: { type: "string", short: "n" },
      mode: { type: "string", short: "m" },
      snippet: { type: "boolean" },
    },
  });

  const query = positionals.join(" ");
  // Allow empty query for filter-only mode (e.g. sp search --type decision)
  if (!query && !values.type && !values.project && !values.tags && !values.limit) {
    outputMessage("Usage: sp search <query> [--type <type>] [--tags <t1,t2>] [--limit <n>]");
    process.exit(2);
  }

  const config = loadConfig();
  if (repoOverride) config.repoPath = repoOverride;

  const results = search(config, {
    query,
    type: values.type,
    project: values.project,
    tags: values.tags ? values.tags.split(",") : undefined,
    limit: values.limit ? parseInt(values.limit) : undefined,
    mode: (values.mode === "or" ? "or" : values.mode === "and" ? "and" : undefined),
    snippet: values.snippet,
  });

  output(results);
}
