import type { ModelStats, ReportMeta, Totals } from "../types.js";
import { fmt, fmtUsd } from "../utils.js";

const COL_MODEL = 28;
const COL_PROV = 12;
const COL_TURNS = 7;
const COL_IN = 12;
const COL_OUT = 12;
const COL_CR = 12;
const COL_CW = 12;
const COL_TOT = 14;
const COL_COST = 12;

const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
const pad = (s: string, n: number) => truncate(s, n).padEnd(n);
const rpad = (s: string, n: number) => s.slice(0, n).padStart(n);

function statsLine(
  r: {
    turns: number;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
    totalTokens: number;
    costTotal: number;
  },
  model: string,
  provider: string,
): string {
  return (
    pad(model, COL_MODEL) +
    pad(provider, COL_PROV) +
    rpad(fmt(r.turns), COL_TURNS) +
    rpad(fmt(r.inputTokens), COL_IN) +
    rpad(fmt(r.outputTokens), COL_OUT) +
    rpad(fmt(r.cacheReadTokens), COL_CR) +
    rpad(fmt(r.cacheWriteTokens), COL_CW) +
    rpad(fmt(r.totalTokens), COL_TOT) +
    rpad(fmtUsd(r.costTotal), COL_COST)
  );
}

export function renderTable(rows: ModelStats[], totals: Totals, meta: ReportMeta): string {
  if (rows.length === 0) {
    return `No assistant messages with usage data found in ${meta.targetDesc}.`;
  }

  const lines: string[] = [];

  const window = meta.daysArg !== null ? ` (last ${meta.daysArg} day${meta.daysArg === 1 ? "" : "s"})` : "";
  lines.push(`Token Usage Report — ${meta.targetDesc}${window}`);
  lines.push(`Sessions: ${meta.sessionCount}  •  Files: ${meta.fileCount}  •  Parse errors: ${meta.errorCount}`);
  lines.push("");

  const header =
    pad("Model", COL_MODEL) +
    pad("Provider", COL_PROV) +
    rpad("Turns", COL_TURNS) +
    rpad("Input", COL_IN) +
    rpad("Output", COL_OUT) +
    rpad("Cache R", COL_CR) +
    rpad("Cache W", COL_CW) +
    rpad("Total", COL_TOT) +
    rpad("Cost", COL_COST);

  const sep = "─".repeat(header.length);

  lines.push(header);
  lines.push(sep);

  for (const r of rows) {
    lines.push(statsLine(r, r.model, r.provider));
  }

  lines.push(sep);
  lines.push(statsLine(totals, "TOTAL", ""));

  return lines.join("\n");
}
