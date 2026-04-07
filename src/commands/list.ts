import { parseArgs } from "util";
import { loadConfig } from "../utils/config.js";
import { list } from "../tools/list.js";
import { output, outputMessage } from "../output.js";

const VALID_CATEGORIES = ["context", "decisions", "experience", "meetings", "plans", "playbook", "clients", "people"];

export function runList(args: string[], repoOverride?: string): void {
  const { positionals, values } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      project: { type: "string", short: "p" },
    },
  });

  const category = positionals[0];
  if (!category) {
    outputMessage(`Usage: sp list <category> [--project <name>]\nCategories: ${VALID_CATEGORIES.join(", ")}`);
    process.exit(2);
  }

  if (!VALID_CATEGORIES.includes(category)) {
    outputMessage(`Invalid category: ${category}\nValid: ${VALID_CATEGORIES.join(", ")}`);
    process.exit(2);
  }

  const config = loadConfig();
  if (repoOverride) config.repoPath = repoOverride;

  const results = list(config, category, values.project);

  output(results);
}
