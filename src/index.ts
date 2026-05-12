/**
 * Token Usage Report Extension
 *
 * /token-report [days|path] [--format table|csv|json|markdown] [--save path]
 * /token-prune <days> [--dry-run] [--force] [--path <dir>]
 *
 * Reads JSONL session files and produces a report showing token usage
 * and cost broken down by model. Also allows pruning old sessions.
 *
 * Report examples:
 *   /token-report                     — report for all sessions (table in TUI)
 *   /token-report 7                   — last 7 days
 *   /token-report /path/to/dir        — specific directory
 *   /token-report --format csv        — CSV to stdout
 *   /token-report --format csv --save report.csv  — CSV to file
 *   /token-report 7 --format json     — JSON to stdout
 *   /token-report --format md         — Markdown to stdout
 *
 * Prune examples:
 *   /token-prune 30              — delete sessions older than 30 days
 *   /token-prune 30 --dry-run    — preview what would be deleted
 *   /token-prune 60 --force      — skip confirmation prompt
 *   /token-prune 60 --path /custom/dir — prune a specific directory
 */

import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { handleReport } from "./report-command.js";
import { parsePruneArgs, pruneSessions, formatPruneReport } from "./prune.js";
import { showTuiOverlay } from "./ui.js";

// ──────────────────────────────────────────────────────────────────────────────
// Prune command handler
// ──────────────────────────────────────────────────────────────────────────────

async function handlePrune(args: string, ctx: ExtensionCommandContext): Promise<void> {
  try {
    const options = parsePruneArgs(args, ctx.cwd);
    const action = options.dryRun ? "Scanning (dry run)" : "Pruning";
    ctx.ui.notify(`${action} sessions older than ${options.days} days…`, "info");

    const result = await pruneSessions(options);
    const report = formatPruneReport(result, options);

    if (ctx.hasUI) {
      await showTuiOverlay(report, ctx);
    } else {
      console.log(report);
    }

    const totalDeleted = result.deletedFiles.length + result.deletedEmptyFiles.length;
    const prefix = options.dryRun ? "Would delete" : "Deleted";
    ctx.ui.notify(`${prefix} ${totalDeleted} file(s).`, "info");
  } catch (err) {
    ctx.ui.notify(`Prune failed: ${(err as Error).message}`, "error");
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Extension entry point
// ──────────────────────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  pi.registerCommand("token-report", {
    description: "Token usage per model. Args: [days|path] [--format table|csv|json|md] [--save file]",

    handler: async (args, ctx) => {
      await handleReport(args, ctx);
    },
  });

  pi.registerCommand("token-prune", {
    description: "Delete old sessions. Args: <days> [--dry-run] [--force] [--path dir]",

    handler: async (args, ctx) => {
      await handlePrune(args, ctx);
    },
  });
}
