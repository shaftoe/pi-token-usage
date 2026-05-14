/**
 * Token Usage Report Extension
 *
 * /token-report [days|path] [--format table|csv|json|markdown] [--save path] [--daily]
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
 *   /token-report --daily             — Daily breakdown by date × model
 *   /token-report 7 --daily --format csv — Daily CSV for last 7 days
 *
 * Prune examples:
 *   /token-prune 30              — delete sessions older than 30 days
 *   /token-prune 30 --dry-run    — preview what would be deleted
 *   /token-prune 60 --force      — skip confirmation prompt
 *   /token-prune 60 --path /custom/dir — prune a specific directory
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { handleReport } from "./report.js";
import { handlePrune } from "./prune.js";

// ──────────────────────────────────────────────────────────────────────────────
// Extension entry point
// ──────────────────────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  pi.registerCommand("token-report", {
    description: "Token usage per model. Args: [days|path] [--format table|csv|json|md] [--save file] [--daily]",
    handler: handleReport,
  });

  pi.registerCommand("token-prune", {
    description: "Delete old sessions. Args: <days> [--dry-run] [--force] [--path dir]",
    handler: handlePrune,
  });
}
