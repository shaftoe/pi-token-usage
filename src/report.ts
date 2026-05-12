import type { OutputFormat, ParsedArgs, ReportMeta } from "./types.js";
import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { Temporal } from "@js-temporal/polyfill";
import { parseArgs } from "./utils.js";
import { scanAndAggregate } from "./parser.js";
import { renderTable } from "./renderers/table.js";
import { renderCsv } from "./renderers/csv.js";
import { renderJson } from "./renderers/json.js";
import { renderMarkdown } from "./renderers/markdown.js";
import { showTuiOverlay } from "./ui.js";

// ──────────────────────────────────────────────────────────────────────────────
// Formatter registry
// ──────────────────────────────────────────────────────────────────────────────

const FORMATTERS: Record<OutputFormat, typeof renderTable> = {
  table: renderTable,
  csv: renderCsv,
  json: renderJson,
  markdown: renderMarkdown,
};

// ──────────────────────────────────────────────────────────────────────────────
// Time window computation
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Convert a "last N days" argument into an epoch-millisecond cutoff,
 * or `null` when no time filter is requested.
 */
export function computeSinceMs(daysArg: number | null): number | null {
  if (daysArg === null) return null;
  return Temporal.Now.zonedDateTimeISO().subtract({ days: daysArg }).toInstant().epochMilliseconds;
}

// ──────────────────────────────────────────────────────────────────────────────
// Report metadata builder
// ──────────────────────────────────────────────────────────────────────────────

export interface ReportData {
  report: string;
  meta: ReportMeta;
}

/**
 * Build the standard `ReportMeta` from a scan result plus the original
 * parsed arguments.
 */
export function buildReportMeta(
  acc: { sessions: number; errors: number },
  fileCount: number,
  parsed: ParsedArgs,
): ReportMeta {
  return {
    sessionCount: acc.sessions,
    fileCount,
    errorCount: acc.errors,
    daysArg: parsed.daysArg,
    targetDesc: parsed.targetDesc,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Full report generation pipeline
// ──────────────────────────────────────────────────────────────────────────────

export class NoFilesError extends Error {
  constructor() {
    super("No .jsonl files found.");
  }
}

export class PathNotFoundError extends Error {
  constructor(path: string) {
    super(`Path not found: ${path}`);
  }
}

/**
 * End-to-end pipeline: validate args → scan files → aggregate → render.
 *
 * Throws `PathNotFoundError` / `NoFilesError` for the two expected
 * user-facing error states so callers can decide how to present them.
 */
export async function generateReport(parsed: ParsedArgs): Promise<ReportData> {
  if (!existsSync(parsed.targetPath)) {
    throw new PathNotFoundError(parsed.targetPath);
  }

  const sinceMs = computeSinceMs(parsed.daysArg);
  const { acc, fileCount } = await scanAndAggregate(parsed.targetPath, sinceMs);

  if (fileCount === 0) {
    throw new NoFilesError();
  }

  const rows = acc.getRows();
  const totals = acc.getTotals();
  const meta = buildReportMeta(acc, fileCount, parsed);

  const render = FORMATTERS[parsed.format];
  const report = render(rows, totals, meta);

  return { report, meta };
}

// ──────────────────────────────────────────────────────────────────────────────
// Report command handler
// ──────────────────────────────────────────────────────────────────────────────

function parseArguments(args: string, ctx: ExtensionCommandContext): ParsedArgs | null {
  try {
    return parseArgs(args, ctx.cwd);
  } catch (err) {
    ctx.ui.notify(String((err as Error).message), "error");
    return null;
  }
}

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

async function saveToFile(report: string, savePath: string, ctx: ExtensionCommandContext): Promise<void> {
  await writeFile(savePath, report, "utf-8");
  ctx.ui.notify(`Report saved to ${savePath}`, "info");
}

export async function handleReport(args: string, ctx: ExtensionCommandContext): Promise<void> {
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
}
