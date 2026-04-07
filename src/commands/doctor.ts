import { loadConfig } from "../utils/config.js";
import { doctor } from "../tools/doctor.js";
import { output, useJson } from "../output.js";

export function runDoctor(args: string[], repoOverride?: string): void {
  const config = loadConfig();
  if (repoOverride) config.repoPath = repoOverride;

  const report = doctor(config.repoPath);

  if (useJson()) {
    output(report);
  } else {
    if (report.findings.length === 0) {
      console.log("No issues found — knowledge base is healthy.");
    } else {
      for (const finding of report.findings) {
        const prefix = finding.level === "error"
          ? "\x1b[31m"   // red
          : finding.level === "warning"
            ? "\x1b[33m" // yellow
            : "\x1b[36m"; // cyan
        const reset = "\x1b[0m";

        console.log(`${prefix}[${finding.category}]${reset} ${finding.message}`);
        if (finding.paths && finding.paths.length > 0) {
          for (const p of finding.paths) {
            console.log(`    ${p}`);
          }
        }
      }
    }

    console.log();
    console.log(
      `Summary: ${report.summary.errors} errors, ${report.summary.warnings} warnings, ${report.summary.info} info`,
    );
  }
}
