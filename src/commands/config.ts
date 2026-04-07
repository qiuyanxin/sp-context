import {
  loadConfig,
  saveConfig,
  addRepo,
  switchRepo,
  listRepos,
} from "../utils/config.js";
import { output, outputMessage, useJson } from "../output.js";

export function runConfig(args: string[]): void {
  const action = args[0];

  if (!action || !["list", "add", "switch"].includes(action)) {
    outputMessage("Usage: sp config <list|add|switch> [args]\n  sp config list\n  sp config add <label> <path> [--remote <name>] [--branch <name>]\n  sp config switch <label>");
    process.exit(2);
  }

  let config = loadConfig();

  switch (action) {
    case "list": {
      const repos = listRepos(config);
      if (!useJson()) {
        console.log("Repositories:");
        for (const r of repos) {
          const marker = r.label === config.activeRepo ? "* " : "  ";
          console.log(`${marker}${r.label}: ${r.path} (${r.remoteName}/${r.defaultBranch})`);
        }
      } else {
        output(repos);
      }
      break;
    }

    case "add": {
      const label = args[1];
      const path = args[2];
      if (!label || !path) {
        outputMessage("Usage: sp config add <label> <path>");
        process.exit(2);
      }
      const remoteIdx = args.indexOf("--remote");
      const branchIdx = args.indexOf("--branch");
      const remoteName = remoteIdx >= 0 ? args[remoteIdx + 1] : undefined;
      const defaultBranch = branchIdx >= 0 ? args[branchIdx + 1] : undefined;

      config = addRepo(config, label, path, remoteName, defaultBranch);
      saveConfig(config);
      outputMessage(`Added repo "${label}" at ${path}`);
      break;
    }

    case "switch": {
      const label = args[1];
      if (!label) {
        outputMessage("Usage: sp config switch <label>");
        process.exit(2);
      }
      const updated = switchRepo(config, label);
      if (!updated) {
        outputMessage(`Repo "${label}" not found.`);
        process.exit(1);
      }
      config = updated;
      saveConfig(config);
      outputMessage(`Switched to repo "${label}" at ${config.repoPath}`);
      break;
    }
  }
}
