import { loadConfig } from "../utils/config.js";
import { get } from "../tools/get.js";
import { output, outputMessage, useJson } from "../output.js";

export function runGet(args: string[], repoOverride?: string): void {
  const docPath = args[0];
  if (!docPath) {
    outputMessage("Usage: sp get <path>");
    process.exit(2);
  }

  const config = loadConfig();
  if (repoOverride) config.repoPath = repoOverride;

  const doc = get(config, docPath);
  if (!doc) {
    outputMessage(`Document not found: ${docPath}`);
    process.exit(1);
  }

  // For JSON mode, output structured data; for TTY, output as markdown with frontmatter
  if (!useJson()) {
    const metaStr = Object.entries(doc.meta)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
      .join("\n");
    console.log(`---\n${metaStr}\n---\n\n${doc.content}`);
  } else {
    output(doc);
  }
}
