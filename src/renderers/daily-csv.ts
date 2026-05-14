import type { DailyModelStats, DailyTotals, ReportMeta, Totals } from "../types.js";
import { csvQuote, fmtDaysSuffix } from "../utils.js";

const COLUMNS = [
  "Date",
  "Model",
  "Provider",
  "Turns",
  "Input Tokens",
  "Output Tokens",
  "Cache Read Tokens",
  "Cache Write Tokens",
  "Total Tokens",
  "Cost Input",
  "Cost Output",
  "Cost Cache Read",
  "Cost Cache Write",
  "Cost Total",
] as const;

function toRow(r: DailyModelStats): string {
  return [
    csvQuote(r.date),
    csvQuote(r.model),
    csvQuote(r.provider),
    String(r.turns),
    String(r.inputTokens),
    String(r.outputTokens),
    String(r.cacheReadTokens),
    String(r.cacheWriteTokens),
    String(r.totalTokens),
    r.costInput.toFixed(6),
    r.costOutput.toFixed(6),
    r.costCacheRead.toFixed(6),
    r.costCacheWrite.toFixed(6),
    r.costTotal.toFixed(6),
  ].join(",");
}

function dailyTotalRow(r: DailyTotals): string {
  return [
    csvQuote(r.date),
    csvQuote("TOTAL"),
    csvQuote(""),
    String(r.turns),
    String(r.inputTokens),
    String(r.outputTokens),
    String(r.cacheReadTokens),
    String(r.cacheWriteTokens),
    String(r.totalTokens),
    r.costInput.toFixed(6),
    r.costOutput.toFixed(6),
    r.costCacheRead.toFixed(6),
    r.costCacheWrite.toFixed(6),
    r.costTotal.toFixed(6),
  ].join(",");
}

function grandTotalRow(r: Totals): string {
  return [
    csvQuote(""),
    csvQuote("GRAND TOTAL"),
    csvQuote(""),
    String(r.turns),
    String(r.inputTokens),
    String(r.outputTokens),
    String(r.cacheReadTokens),
    String(r.cacheWriteTokens),
    String(r.totalTokens),
    r.costInput.toFixed(6),
    r.costOutput.toFixed(6),
    r.costCacheRead.toFixed(6),
    r.costCacheWrite.toFixed(6),
    r.costTotal.toFixed(6),
  ].join(",");
}

export function renderDailyCsv(
  rows: DailyModelStats[],
  dailyTotals: DailyTotals[],
  grandTotals: Totals,
  meta: ReportMeta,
): string {
  const lines: string[] = [];

  lines.push(COLUMNS.join(","));

  // Group rows by date, inserting daily totals
  let currentDate = "";
  for (const r of rows) {
    if (r.date !== currentDate) {
      if (currentDate !== "") {
        const dt = dailyTotals.find((d) => d.date === currentDate);
        if (dt) lines.push(dailyTotalRow(dt));
      }
      currentDate = r.date;
    }
    lines.push(toRow(r));
  }
  if (currentDate !== "") {
    const dt = dailyTotals.find((d) => d.date === currentDate);
    if (dt) lines.push(dailyTotalRow(dt));
  }

  lines.push(grandTotalRow(grandTotals));

  // Metadata as comments
  const window = fmtDaysSuffix(meta.daysArg);
  lines.push("");
  lines.push(`# Token Usage Report (daily) — ${meta.targetDesc}${window}`);
  lines.push(`# Sessions: ${meta.sessionCount}  •  Files: ${meta.fileCount}  •  Parse errors: ${meta.errorCount}`);

  return lines.join("\n");
}
