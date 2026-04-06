import type { ModelStats, ReportMeta, Totals } from "../types.js";

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
      window: meta.daysArg !== null ? `last ${meta.daysArg} day${meta.daysArg === 1 ? "" : "s"}` : null,
      sessionCount: meta.sessionCount,
      fileCount: meta.fileCount,
      errorCount: meta.errorCount,
    },
    models: rows,
    totals,
  };

  return JSON.stringify(report, null, 2);
}
