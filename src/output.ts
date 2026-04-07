/**
 * Unified output module — auto-detects TTY vs pipe.
 * TTY → human-readable, pipe → JSON.
 * --json flag forces JSON regardless.
 */

const isTTY = process.stdout.isTTY ?? false;

let forceJson = false;

export function setForceJson(val: boolean): void {
  forceJson = val;
}

export function useJson(): boolean {
  return forceJson || !isTTY;
}

export function output(data: unknown): void {
  if (useJson()) {
    console.log(JSON.stringify(data, null, 2));
  } else if (typeof data === "string") {
    console.log(data);
  } else if (Array.isArray(data)) {
    if (data.length === 0) {
      console.log("No results.");
      return;
    }
    for (const item of data) {
      formatEntry(item);
    }
  } else if (typeof data === "object" && data !== null) {
    formatEntry(data as Record<string, unknown>);
  } else {
    console.log(String(data));
  }
}

function formatEntry(item: Record<string, unknown>): void {
  const title = item.title ?? item.label ?? item.path ?? "";
  const type = item.type ? ` (${item.type})` : "";
  const path = item.path ? `  path: ${item.path}` : "";
  const tags = Array.isArray(item.tags) && item.tags.length > 0
    ? `  tags: ${item.tags.join(", ")}`
    : "";
  const summary = item.summary ? `  ${item.summary}` : "";

  console.log(`  ${title}${type}`);
  if (path) console.log(path);
  if (tags) console.log(tags);
  if (summary) console.log(summary);
  console.log();
}

export function outputError(msg: string): void {
  console.error(msg);
}

export function outputMessage(msg: string): void {
  if (useJson()) {
    console.log(JSON.stringify({ message: msg }));
  } else {
    console.log(msg);
  }
}
