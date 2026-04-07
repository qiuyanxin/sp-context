import { parseArgs } from "util";
import { readFileSync } from "fs";
import { loadConfig } from "../utils/config.js";
import { push } from "../tools/push.js";
import { outputMessage } from "../output.js";

const VALID_TYPES = ["reference", "learning", "decision", "meeting", "status", "playbook", "personal"];

export async function runPush(args: string[], repoOverride?: string): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      title: { type: "string" },
      type: { type: "string", short: "t" },
      tags: { type: "string" },
      project: { type: "string", short: "p" },
      content: { type: "string", short: "c" },
      file: { type: "string", short: "f" },
      dir: { type: "string", short: "d" },
      ttl: { type: "string" },
      category: { type: "string" },
    },
  });

  if (!values.title || !values.type) {
    outputMessage("Usage: sp push --title <title> --type <type> [--tags <t1,t2>] [--content <text> | --file <path>] [--dir <path>] [--ttl <e.g. 30d>]");
    process.exit(2);
  }

  if (!VALID_TYPES.includes(values.type)) {
    outputMessage(`Invalid type: ${values.type}\nValid: ${VALID_TYPES.join(", ")}`);
    process.exit(2);
  }

  let content = values.content ?? "";
  if (values.file) {
    content = readFileSync(values.file, "utf-8");
  }
  if (!content) {
    if (process.stdin.isTTY) {
      outputMessage("Error: provide --content <text> or --file <path>, or pipe content via stdin.");
      process.exit(2);
    }
    content = readFileSync("/dev/stdin", "utf-8");
  }

  const config = loadConfig();
  if (repoOverride) config.repoPath = repoOverride;

  const result = await push(config, {
    title: values.title,
    content,
    type: values.type,
    project: values.project,
    tags: values.tags ? values.tags.split(",") : undefined,
    dir: values.dir,
    ttl: values.ttl,
    category: values.category,
  });

  outputMessage(result);
}
