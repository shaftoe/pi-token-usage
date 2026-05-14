import type { DailyModelStats, DailyTotals, ReportMeta, Totals } from "../types.js";
import { fmt, fmtUsd, fmtDaysSuffix } from "../utils.js";

const COL_DATE = 12;
const COL_MODEL = 28;
const COL_PROV = 12;
const COL_TURNS = 7;
const COL_IN = 12;
const COL_OUT = 12;
const COL_CR = 14;
const COL_CW = 13;
const COL_TOT = 15;
const COL_COST = 13;

const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
const pad = (s: string, n: number) => truncate(s, n).padEnd(n);
const rpad = (s: string, n: number) => s.padStart(n);

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
  date: string,
  model: string,
  provider: string,
): string {
  return (
    pad(date, COL_DATE) +
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

function dailyTotalLine(r: DailyTotals): string {
  return (
    pad("", COL_DATE) +
    pad(`${r.date} TOTAL`, COL_MODEL) +
    pad("", COL_PROV) +
    rpad(fmt(r.turns), COL_TURNS) +
    rpad(fmt(r.inputTokens), COL_IN) +
    rpad(fmt(r.outputTokens), COL_OUT) +
    rpad(fmt(r.cacheReadTokens), COL_CR) +
    rpad(fmt(r.cacheWriteTokens), COL_CW) +
    rpad(fmt(r.totalTokens), COL_TOT) +
    rpad(fmtUsd(r.costTotal), COL_COST)
  );
}

function grandTotalLine(r: Totals): string {
  return (
    pad("", COL_DATE) +
    pad("GRAND TOTAL", COL_MODEL) +
    pad("", COL_PROV) +
    rpad(fmt(r.turns), COL_TURNS) +
    rpad(fmt(r.inputTokens), COL_IN) +
    rpad(fmt(r.outputTokens), COL_OUT) +
    rpad(fmt(r.cacheReadTokens), COL_CR) +
    rpad(fmt(r.cacheWriteTokens), COL_CW) +
    rpad(fmt(r.totalTokens), COL_TOT) +
    rpad(fmtUsd(r.costTotal), COL_COST)
  );
}

export function renderDailyTable(
  rows: DailyModelStats[],
  dailyTotals: DailyTotals[],
  grandTotals: Totals,
  meta: ReportMeta,
): string {
  if (rows.length === 0) {
    return `No assistant messages with usage data found in ${meta.targetDesc}.`;
  }

  const lines: string[] = [];

  const window = fmtDaysSuffix(meta.daysArg);
  lines.push(`Token Usage Report (daily) — ${meta.targetDesc}${window}`);
  lines.push(`Sessions: ${meta.sessionCount}  •  Files: ${meta.fileCount}  •  Parse errors: ${meta.errorCount}`);
  lines.push("");

  const header =
    pad("Date", COL_DATE) +
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

  // Group rows by date for display
  let currentDate = "";
  for (const r of rows) {
    if (r.date !== currentDate) {
      // If we had a previous date group, emit its daily total
      if (currentDate !== "") {
        const dt = dailyTotals.find((d) => d.date === currentDate);
        if (dt) lines.push(dailyTotalLine(dt));
        lines.push(sep);
      }
      currentDate = r.date;
    }
    lines.push(statsLine(r, r.date, r.model, r.provider));
  }

  // Last date group's total
  if (currentDate !== "") {
    const dt = dailyTotals.find((d) => d.date === currentDate);
    if (dt) lines.push(dailyTotalLine(dt));
  }

  lines.push(sep);
  lines.push(grandTotalLine(grandTotals));

  return lines.join("\n");
}
