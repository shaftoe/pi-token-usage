import type { DailyModelStats, DailyTotals, ReportMeta, Totals } from "../types.js";
import { fmtDaysLabel } from "../utils.js";

interface DailyJsonReport {
  meta: {
    target: string;
    window: string | null;
    sessionCount: number;
    fileCount: number;
    errorCount: number;
    daily: true;
  };
  days: {
    date: string;
    models: DailyModelStats[];
    totals: DailyTotals;
  }[];
  grandTotals: Totals;
}

export function renderDailyJson(
  rows: DailyModelStats[],
  dailyTotals: DailyTotals[],
  grandTotals: Totals,
  meta: ReportMeta,
): string {
  // Group rows by date
  const dateGroups = new Map<string, DailyModelStats[]>();
  for (const r of rows) {
    if (!dateGroups.has(r.date)) {
      dateGroups.set(r.date, []);
    }
    dateGroups.get(r.date)!.push(r);
  }

  const days = dailyTotals
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((dt) => ({
      date: dt.date,
      models: dateGroups.get(dt.date) ?? [],
      totals: dt,
    }));

  const report: DailyJsonReport = {
    meta: {
      target: meta.targetDesc,
      window: fmtDaysLabel(meta.daysArg),
      sessionCount: meta.sessionCount,
      fileCount: meta.fileCount,
      errorCount: meta.errorCount,
      daily: true,
    },
    days,
    grandTotals,
  };

  return JSON.stringify(report, null, 2);
}
