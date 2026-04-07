import type { ModelStats, ReportMeta, Totals } from "../types.js";
import { formatDaysLabel } from "../utils.js";

interface JsonReport {
  meta: {
    target: string;
    window: string | null;
    sessionCount: number;
    fileCount: number;
    errorCount: number;
  };
  models: ModelStats[];
  totals: Totals;
}

export function renderJson(rows: ModelStats[], totals: Totals, meta: ReportMeta): string {
  const report: JsonReport = {
    meta: {
      target: meta.targetDesc,
      window: formatDaysLabel(meta.daysArg),
      sessionCount: meta.sessionCount,
      fileCount: meta.fileCount,
      errorCount: meta.errorCount,
    },
    models: rows,
    totals,
  };

  return JSON.stringify(report, null, 2);
}
