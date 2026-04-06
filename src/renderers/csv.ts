import type { ModelStats, ReportMeta, Totals } from "../types.js";
import { csvQuote } from "../utils.js";

const COLUMNS = [
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

function toRow(r: ModelStats | (Totals & { model: string; provider: string })): string {
  return [
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

export function renderCsv(rows: ModelStats[], totals: Totals, meta: ReportMeta): string {
  const lines: string[] = [];

  lines.push(COLUMNS.join(","));
  for (const r of rows) {
    lines.push(toRow(r));
  }
  lines.push(toRow({ ...totals, model: "TOTAL", provider: "" }));

  // Append metadata as comments (CSV standard: lines starting with #)
  const window = meta.daysArg !== null ? ` (last ${meta.daysArg} day${meta.daysArg === 1 ? "" : "s"})` : "";
  lines.push("");
  lines.push(`# Token Usage Report — ${meta.targetDesc}${window}`);
  lines.push(`# Sessions: ${meta.sessionCount}  •  Files: ${meta.fileCount}  •  Parse errors: ${meta.errorCount}`);

  return lines.join("\n");
}
