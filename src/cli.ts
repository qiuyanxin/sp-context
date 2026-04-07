#!/usr/bin/env bun
/**
 * sp — CLI for company context management via sp-context git repo.
 *
 * Usage:
 *   sp <command> [args] [flags]
 *
 * Commands:
 *   search <query>     Search documents by keywords
 *   get <path>         Read full document content
 *   list <category>    List documents in a category
 *   push               Write a new document
 *   sync               Pull remote and rebuild index
 *   import             Import from claude-mem
 *   init [path]        Initialize new sp-context repo
 *   add                Add local files to sp-context
 *   config             Manage repositories
 *   doctor             Check knowledge base quality
 *   schema             Knowledge base metadata introspection
 *   gc                 Clean up expired documents
 *
 * Global flags:
 *   --json             Force JSON output
 *   --repo <path>      Override repository path
 *   --help, -h         Show help
 *   --version, -v      Show version
 */

import { setForceJson } from "./output.js";
import { runSearch } from "./commands/search.js";
import { runGet } from "./commands/get.js";
import { runList } from "./commands/list.js";
import { runPush } from "./commands/push.js";
import { runSync } from "./commands/sync.js";
import { runImport } from "./commands/import.js";
import { runInit } from "./commands/init.js";
import { runConfig } from "./commands/config.js";
import { runAdd } from "./commands/add.js";
import { runDelete } from "./commands/delete.js";
import { runMove } from "./commands/move.js";
import { runDoctor } from "./commands/doctor.js";
import { runSchema } from "./commands/schema.js";
import { runGc } from "./commands/gc.js";

const VERSION = "1.2.0";

const rawArgs = process.argv.slice(2);

// Extract global flags before subcommand parsing
let repoOverride: string | undefined;
const filteredArgs: string[] = [];
let jsonFlag = false;

for (let i = 0; i < rawArgs.length; i++) {
  const arg = rawArgs[i];
  if (arg === "--json") {
    jsonFlag = true;
  } else if (arg === "--repo" && i + 1 < rawArgs.length) {
    repoOverride = rawArgs[++i];
  } else if (arg === "--version" || arg === "-v") {
    console.log(VERSION);
    process.exit(0);
  } else if ((arg === "--help" || arg === "-h") && filteredArgs.length === 0) {
    printHelp();
    process.exit(0);
  } else {
    filteredArgs.push(arg);
  }
}

if (jsonFlag) setForceJson(true);

const command = filteredArgs[0];
const commandArgs = filteredArgs.slice(1);

async function main(): Promise<void> {
  switch (command) {
    case "search":
      runSearch(commandArgs, repoOverride);
      break;
    case "get":
      runGet(commandArgs, repoOverride);
      break;
    case "list":
      runList(commandArgs, repoOverride);
      break;
    case "push":
      await runPush(commandArgs, repoOverride);
      break;
    case "sync":
      await runSync(repoOverride);
      break;
    case "import":
      await runImport(commandArgs, repoOverride);
      break;
    case "init":
      await runInit(commandArgs, repoOverride);
      break;
    case "add":
      await runAdd(commandArgs, repoOverride);
      break;
    case "delete":
    case "rm":
      await runDelete(commandArgs, repoOverride);
      break;
    case "move":
    case "mv":
      await runMove(commandArgs, repoOverride);
      break;
    case "doctor":
      runDoctor(commandArgs, repoOverride);
      break;
    case "schema":
      runSchema(commandArgs, repoOverride);
      break;
    case "gc":
      runGc(commandArgs, repoOverride);
      break;
    case "config":
      runConfig(commandArgs);
      break;
    case undefined:
      printHelp();
      break;
    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(2);
  }
}

function printHelp(): void {
  console.log(`sp v${VERSION} — Company context management CLI

Usage: sp <command> [args] [flags]

Commands:
  search <query>     Search documents by keywords
                     --type, -t <type>    Filter by type
                     --tags <t1,t2>       Filter by tags
                     --limit, -n <n>      Max results (default 10)
                     --mode, -m <and|or>  Combine mode (default: and)
                     --snippet            Include keyword context

  get <path>         Read full document content

  list <category>    List documents in a category
                     --project, -p <name> Filter by project
                     Categories: context, decisions, experience,
                       meetings, plans, playbook, clients, people

  push               Write a new document
                     --title <title>      Document title (required)
                     --type, -t <type>    Document type (required)
                     --tags <t1,t2>       Tags (auto-lowercased)
                     --content, -c <text> Content (or --file, or stdin)
                     --file, -f <path>    Read content from file
                     --dir, -d <path>     Override output directory
                     --ttl <e.g. 30d>     Auto-set expiry date
                     --category <name>    Personal sub-folder
                       (e.g. research, drafts, notes)
                     Types: reference, learning, decision, meeting,
                       status, playbook, personal

  doctor             Check knowledge base quality
                     Detects duplicates, stale docs, tag issues,
                     broken links, unused docs

  schema             Knowledge base metadata introspection
                     Returns types, categories, tags, stats, usage

  gc                 Clean up expired documents
                     --yes, -y            Auto-archive without prompt

  sync               Pull remote and rebuild INDEX.json

  delete <path>      Delete a document (alias: rm)
                     Removes file, rebuilds INDEX, commits and pushes

  move <path>        Move a document to another directory (alias: mv)
                     --to <dir>           Target directory (required)

  import             Import from claude-mem
                     --ids <id1,id2>      Observation IDs
                     --query, -q <q>      Search query
                     --limit, -n <n>      Max observations

  add <file|dir>     Add local files to sp-context
                     --to <path>          Target path in repo
                     --yes, -y            Skip confirmation
                     Without --to: suggests path, waits for review

  init [path]        Initialize new sp-context repo

  config             Manage repositories
                     list                 List all repos
                     add <label> <path>   Add a repo
                     switch <label>       Switch active repo

Global flags:
  --json             Force JSON output (auto-detected in pipe)
  --repo <path>      Override repository path
  --help, -h         Show this help
  --version, -v      Show version`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
