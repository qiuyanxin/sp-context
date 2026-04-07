import { parseArgs } from "util";
import { resolve, dirname, basename } from "path";
import { readFileSync } from "fs";
import { loadConfig } from "../utils/config.js";
import { suggestAdd, executeAdd } from "../tools/add.js";
import { output, outputMessage, useJson } from "../output.js";
import { createInterface } from "readline";
import { datePrefixedName } from "../utils/doc-guards.js";

export async function runAdd(args: string[], repoOverride?: string): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      to: { type: "string" },
      yes: { type: "boolean", short: "y" },
    },
  });

  if (positionals.length === 0) {
    outputMessage("Usage: sp add <file-or-dir> [--to <target-path>] [--yes]");
    process.exit(2);
  }

  const config = loadConfig();
  if (repoOverride) config.repoPath = repoOverride;

  const sourcePaths = positionals.map((p) => resolve(p));

  // If --to is specified, skip suggestion and directly add
  if (values.to) {
    const items = sourcePaths.map((source) => {
      let target = values.to!.endsWith("/")
        ? values.to! + source.split("/").pop()!
        : values.to!;

      // Apply date prefix to .md files if the filename doesn't already have one
      if (target.endsWith(".md")) {
        const dir = dirname(target);
        const file = basename(target);
        if (!/^\d{4}-\d{2}-\d{2}/.test(file)) {
          // Infer title from file content or filename
          const raw = readFileSync(source, "utf-8");
          const headingMatch = raw.match(/^#\s+(.+)$/m);
          const title = headingMatch ? headingMatch[1].trim() : file.replace(/\.md$/, "").replace(/[-_]/g, " ");
          const prefixed = datePrefixedName(title, file);
          target = dir === "." ? prefixed : `${dir}/${prefixed}`;
        }
      }

      return { source, target };
    });
    const result = await executeAdd(config, items);
    outputMessage(result);
    return;
  }

  // Generate suggestions
  const suggestions = suggestAdd(config, sourcePaths);

  if (suggestions.length === 0) {
    outputMessage("No files found to add.");
    return;
  }

  // In JSON/pipe mode: output suggestions for agent to review
  if (useJson()) {
    if (values.yes) {
      // --yes in pipe mode: execute directly
      const items = suggestions.map((s) => ({ source: s.source, target: s.target }));
      const result = await executeAdd(config, items);
      outputMessage(result);
    } else {
      // Output suggestions as JSON for agent to review
      output(suggestions);
      // Agent should call again with: sp add <file> --to <suggested-path> --yes
    }
    return;
  }

  // In TTY mode: interactive confirmation
  console.log("Suggested file placement:\n");
  for (const s of suggestions) {
    console.log(`  ${s.source}`);
    console.log(`    → ${s.target}`);
    console.log(`    reason: ${s.reason}`);
    console.log();
  }

  if (values.yes) {
    const items = suggestions.map((s) => ({ source: s.source, target: s.target }));
    const result = await executeAdd(config, items);
    console.log(result);
    return;
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise<string>((resolve) => {
    rl.question("Proceed? (y/n/edit) ", resolve);
  });
  rl.close();

  if (answer.toLowerCase() === "y" || answer.toLowerCase() === "yes") {
    const items = suggestions.map((s) => ({ source: s.source, target: s.target }));
    const result = await executeAdd(config, items);
    console.log(result);
  } else if (answer.toLowerCase() === "edit" || answer.toLowerCase() === "e") {
    console.log("Re-run with --to <path> to specify target manually:");
    for (const s of suggestions) {
      console.log(`  sp add ${s.source} --to ${s.target}`);
    }
  } else {
    console.log("Cancelled.");
  }
}
