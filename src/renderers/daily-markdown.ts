import type { DailyModelStats, DailyTotals, ReportMeta, Totals } from "../types.js";
import { fmt, fmtUsd, fmtDaysSuffix } from "../utils.js";

function mdCell(s: string): string {
  return ` ${s} |`;
}

function statsToMdRow(
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
    mdCell(date) +
    mdCell(model) +
    mdCell(provider) +
    mdCell(fmt(r.turns)) +
    mdCell(fmt(r.inputTokens)) +
    mdCell(fmt(r.outputTokens)) +
    mdCell(fmt(r.cacheReadTokens)) +
    mdCell(fmt(r.cacheWriteTokens)) +
    mdCell(fmt(r.totalTokens)) +
    mdCell(fmtUsd(r.costTotal))
  );
}

function dailyTotalMdRow(r: DailyTotals): string {
  return (
    mdCell(`**${r.date}**`) +
    mdCell("**TOTAL**") +
    mdCell("") +
    mdCell(fmt(r.turns)) +
    mdCell(fmt(r.inputTokens)) +
    mdCell(fmt(r.outputTokens)) +
    mdCell(fmt(r.cacheReadTokens)) +
    mdCell(fmt(r.cacheWriteTokens)) +
    mdCell(fmt(r.totalTokens)) +
    mdCell(fmtUsd(r.costTotal))
  );
}

function grandTotalMdRow(r: Totals): string {
  return (
    mdCell("") +
    mdCell("**GRAND TOTAL**") +
    mdCell("") +
    mdCell(fmt(r.turns)) +
    mdCell(fmt(r.inputTokens)) +
    mdCell(fmt(r.outputTokens)) +
    mdCell(fmt(r.cacheReadTokens)) +
    mdCell(fmt(r.cacheWriteTokens)) +
    mdCell(fmt(r.totalTokens)) +
    mdCell(fmtUsd(r.costTotal))
  );
}

export function renderDailyMarkdown(
  rows: DailyModelStats[],
  dailyTotals: DailyTotals[],
  grandTotals: Totals,
  meta: ReportMeta,
): string {
  const lines: string[] = [];

  const window = fmtDaysSuffix(meta.daysArg);
  lines.push(`## Token Usage Report (daily) — ${meta.targetDesc}${window}`);
  lines.push("");
  lines.push(
    `**Sessions:** ${meta.sessionCount} • **Files:** ${meta.fileCount} • **Parse errors:** ${meta.errorCount}`,
  );
  lines.push("");

  if (rows.length === 0) {
    lines.push("*No assistant messages with usage data found.*");
    return lines.join("\n");
  }

  // Header
  const header =
    mdCell("Date") +
    mdCell("Model") +
    mdCell("Provider") +
    mdCell("Turns") +
    mdCell("Input") +
    mdCell("Output") +
    mdCell("Cache R") +
    mdCell("Cache W") +
    mdCell("Total") +
    mdCell("Cost");

  const separator =
    mdCell("---") +
    mdCell("---") +
    mdCell("---") +
    mdCell("---:") +
    mdCell("---:") +
    mdCell("---:") +
    mdCell("---:") +
    mdCell("---:") +
    mdCell("---:") +
    mdCell("---:");

  lines.push(header);
  lines.push(separator);

  // Group rows by date
  let currentDate = "";
  for (const r of rows) {
    if (r.date !== currentDate) {
      if (currentDate !== "") {
        const dt = dailyTotals.find((d) => d.date === currentDate);
        if (dt) lines.push(dailyTotalMdRow(dt));
        lines.push(separator);
      }
      currentDate = r.date;
    }
    lines.push(statsToMdRow(r, r.date, r.model, r.provider));
  }

  // Last date group total
  if (currentDate !== "") {
    const dt = dailyTotals.find((d) => d.date === currentDate);
    if (dt) lines.push(dailyTotalMdRow(dt));
  }

  lines.push(separator);
  lines.push(grandTotalMdRow(grandTotals));

  return lines.join("\n");
}
