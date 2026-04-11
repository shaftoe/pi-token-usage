/**
 * Token Usage Report Extension
 *
 * /token-report [days|path] [--format table|csv|json|markdown] [--save path]
 *
 * Reads JSONL session files and produces a report showing token usage
 * and cost broken down by model.
 *
 * Examples:
 *   /token-report                     — report for all sessions (table in TUI)
 *   /token-report 7                   — last 7 days
 *   /token-report /path/to/dir        — specific directory
 *   /token-report --format csv        — CSV to stdout
 *   /token-report --format csv --save report.csv  — CSV to file
 *   /token-report 7 --format json     — JSON to stdout
 *   /token-report --format md         — Markdown to stdout
 */

import type { ExtensionAPI, ExtensionCommandContext } from "@mariozechner/pi-coding-agent";
import type { ParsedArgs } from "./types.js";
import { writeFile } from "node:fs/promises";
import { parseArgs } from "./utils.js";
import { generateReport, NoFilesError, PathNotFoundError } from "./report.js";
import { showTuiOverlay } from "./ui.js";
import { parsePruneArgs, pruneSessions, formatPruneReport } from "./prune.js";

// ──────────────────────────────────────────────────────────────────────────────
// Step 1: Parse and validate arguments
// ──────────────────────────────────────────────────────────────────────────────

function parseArguments(args: string, ctx: ExtensionCommandContext): ParsedArgs | null {
  try {
    return parseArgs(args, ctx.cwd);
  } catch (err) {
    ctx.ui.notify(String((err as Error).message), "error");
    return null;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Step 2: Generate the report (scan + aggregate + render)
// ──────────────────────────────────────────────────────────────────────────────

async function tryGenerateReport(parsed: ParsedArgs, ctx: ExtensionCommandContext): Promise<{ report: string } | null> {
  ctx.ui.notify("Scanning session files…", "info");

  try {
    return await generateReport(parsed);
  } catch (err) {
    if (err instanceof PathNotFoundError || err instanceof NoFilesError) {
      ctx.ui.notify(err.message, err instanceof NoFilesError ? "warning" : "error");
      return null;
    }
    throw err;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Step 3: Save report to file (--save flag)
// ──────────────────────────────────────────────────────────────────────────────

async function saveToFile(report: string, savePath: string, ctx: ExtensionCommandContext): Promise<void> {
  await writeFile(savePath, report, "utf-8");
  ctx.ui.notify(`Report saved to ${savePath}`, "info");
}

// ──────────────────────────────────────────────────────────────────────────────
// Prune command handler
// ──────────────────────────────────────────────────────────────────────────────

async function handlePrune(args: string, ctx: ExtensionCommandContext): Promise<void> {
  const options = parsePruneArgs(args, ctx.cwd);
  if (!options) {
    ctx.ui.notify("Invalid arguments. Usage: /token-prune <days> [--dry-run] [--path <dir>]", "error");
    return;
  }

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
}

// ──────────────────────────────────────────────────────────────────────────────
// Extension entry point
// ──────────────────────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  pi.registerCommand("token-report", {
    description: "Token usage per model. Args: [days|path] [--format table|csv|json|md] [--save file]",

    handler: async (args, ctx) => {
      const parsed = parseArguments(args, ctx);
      if (!parsed) return;

      const result = await tryGenerateReport(parsed, ctx);
      if (!result) return;

      if (parsed.savePath) {
        await saveToFile(result.report, parsed.savePath, ctx);
        return;
      }

      if (parsed.format === "table" && ctx.hasUI) {
        await showTuiOverlay(result.report, ctx);
      } else {
        console.log(result.report);
      }
    },
  });

  pi.registerCommand("token-prune", {
    description: "Delete old sessions. Args: <days> [--dry-run] [--path dir]",

    handler: async (args, ctx) => {
      await handlePrune(args, ctx);
    },
  });
}
