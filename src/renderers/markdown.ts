import type { ModelStats, ReportMeta, Totals } from "../types.js";
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
  model: string,
  provider: string,
): string {
  return (
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

export function renderMarkdown(rows: ModelStats[], totals: Totals, meta: ReportMeta): string {
  const lines: string[] = [];

  const window = fmtDaysSuffix(meta.daysArg);
  lines.push(`## Token Usage Report — ${meta.targetDesc}${window}`);
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
    mdCell("Model") +
    mdCell("Provider") +
    mdCell("Turns") +
    mdCell("Input") +
    mdCell("Output") +
    mdCell("Cache R") +
    mdCell("Cache W") +
    mdCell("Total") +
    mdCell("Cost");

  // Alignment (left for text, right for numbers)
  const separator =
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

  for (const r of rows) {
    lines.push(statsToMdRow(r, r.model, r.provider));
  }

  lines.push(separator);
  lines.push(statsToMdRow(totals, "**TOTAL**", ""));

  return lines.join("\n");
}
