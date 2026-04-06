import type { OutputFormat, ParsedArgs, ReportMeta } from "./types.js";
import { existsSync } from "node:fs";
import { Temporal } from "@js-temporal/polyfill";
import { scanAndAggregate } from "./parser.js";
import { renderTable } from "./renderers/table.js";
import { renderCsv } from "./renderers/csv.js";
import { renderJson } from "./renderers/json.js";
import { renderMarkdown } from "./renderers/markdown.js";

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
