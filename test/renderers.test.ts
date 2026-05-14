import { describe, test, expect } from "bun:test";
import { renderTable } from "../src/renderers/table.js";
import { renderCsv } from "../src/renderers/csv.js";
import { renderJson } from "../src/renderers/json.js";
import { renderMarkdown } from "../src/renderers/markdown.js";
import { renderDailyTable } from "../src/renderers/daily-table.js";
import { renderDailyCsv } from "../src/renderers/daily-csv.js";
import { renderDailyJson } from "../src/renderers/daily-json.js";
import { renderDailyMarkdown } from "../src/renderers/daily-markdown.js";
import type { DailyModelStats, DailyTotals, ModelStats, ReportMeta, Totals } from "../src/types.js";

// Shared test data
const rows: ModelStats[] = [
  {
    model: "claude-sonnet-4-20250514",
    provider: "anthropic",
    turns: 10,
    inputTokens: 50000,
    outputTokens: 12000,
    cacheReadTokens: 8000,
    cacheWriteTokens: 2000,
    totalTokens: 72000,
    costInput: 0.15,
    costOutput: 0.036,
    costCacheRead: 0.004,
    costCacheWrite: 0.005,
    costTotal: 0.195,
  },
  {
    model: "gpt-4o",
    provider: "openai",
    turns: 5,
    inputTokens: 20000,
    outputTokens: 8000,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    totalTokens: 28000,
    costInput: 0.06,
    costOutput: 0.024,
    costCacheRead: 0,
    costCacheWrite: 0,
    costTotal: 0.084,
  },
];

const totals: Totals = {
  turns: 15,
  inputTokens: 70000,
  outputTokens: 20000,
  cacheReadTokens: 8000,
  cacheWriteTokens: 2000,
  totalTokens: 100000,
  costInput: 0.21,
  costOutput: 0.06,
  costCacheRead: 0.004,
  costCacheWrite: 0.005,
  costTotal: 0.279,
};

const meta: ReportMeta = {
  sessionCount: 8,
  fileCount: 12,
  errorCount: 1,
  daysArg: 7,
  targetDesc: "~/.pi/agent/sessions",
};

describe("renderTable", () => {
  test("renders a formatted table with all columns", () => {
    const result = renderTable(rows, totals, meta);

    expect(result).toContain("Token Usage Report");
    expect(result).toContain("~/.pi/agent/sessions");
    expect(result).toContain("last 7 days");
    expect(result).toContain("Sessions: 8");
    expect(result).toContain("claude-sonnet-4-20250514");
    expect(result).toContain("gpt-4o");
    expect(result).toContain("TOTAL");
    expect(result).toContain("─");
  });

  test("shows empty message when no rows", () => {
    const result = renderTable(
      [],
      {
        turns: 0,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        totalTokens: 0,
        costInput: 0,
        costOutput: 0,
        costCacheRead: 0,
        costCacheWrite: 0,
        costTotal: 0,
      },
      meta,
    );
    expect(result).toContain("No assistant messages");
  });

  test("uses singular 'day' when daysArg is 1", () => {
    const result = renderTable(rows, totals, { ...meta, daysArg: 1 });
    expect(result).toContain("(last 1 day)");
    expect(result).not.toContain("(last 1 days)");
  });

  test("uses plural 'days' when daysArg is > 1", () => {
    const result = renderTable(rows, totals, { ...meta, daysArg: 2 });
    expect(result).toContain("(last 2 days)");
  });

  test("shows no window when daysArg is null", () => {
    const result = renderTable(rows, totals, { ...meta, daysArg: null });
    expect(result).not.toContain("last");
    expect(result).not.toContain("day");
  });

  test("renders billion-scale token counts without truncation", () => {
    const bigRow: ModelStats = {
      model: "claude-sonnet-4-6",
      provider: "anthropic",
      turns: 99999,
      inputTokens: 999999999,
      outputTokens: 999999999,
      cacheReadTokens: 9999999999,
      cacheWriteTokens: 999999999,
      totalTokens: 99999999999,
      costInput: 0,
      costOutput: 0,
      costCacheRead: 0,
      costCacheWrite: 0,
      costTotal: 0,
    };

    const bigTotals: Totals = {
      turns: bigRow.turns,
      inputTokens: bigRow.inputTokens,
      outputTokens: bigRow.outputTokens,
      cacheReadTokens: bigRow.cacheReadTokens,
      cacheWriteTokens: bigRow.cacheWriteTokens,
      totalTokens: bigRow.totalTokens,
      costInput: bigRow.costInput,
      costOutput: bigRow.costOutput,
      costCacheRead: bigRow.costCacheRead,
      costCacheWrite: bigRow.costCacheWrite,
      costTotal: bigRow.costTotal,
    };

    const result = renderTable([bigRow], bigTotals, meta);
    const lines = result.split("\n");

    // The TOTAL row should contain the full cacheRead value (9,999,999,999)
    const totalLine = lines.find((l) => l.includes("TOTAL"));
    expect(totalLine).toBeDefined();
    expect(totalLine).toContain("9,999,999,999"); // cacheRead - must not be truncated
    expect(totalLine).toContain("99,999,999,999"); // totalTokens - must not be truncated
  });

  test("truncates long model names with ellipsis to prevent column overlap", () => {
    const longModelRow: ModelStats = {
      model: "gemini-2.5-flash-lite-preview",
      provider: "google",
      turns: 10,
      inputTokens: 50000,
      outputTokens: 12000,
      cacheReadTokens: 8000,
      cacheWriteTokens: 2000,
      totalTokens: 72000,
      costInput: 0.15,
      costOutput: 0.036,
      costCacheRead: 0.004,
      costCacheWrite: 0.005,
      costTotal: 0.195,
    };

    const result = renderTable([longModelRow], totals, meta);
    const lines = result.split("\n");

    // Find the data row (skip header, separator, etc.)
    const dataRow = lines.find((l) => l.includes("gemini"));

    expect(dataRow).toBeDefined();
    expect(dataRow).toContain("…"); // ellipsis should be present
    expect(dataRow).toContain("google"); // provider should be present

    // Provider should not be immediately after truncated model without space
    // i.e., should NOT have "...previegoogle" like the bug showed
    const truncatedPart = dataRow?.match(/gemini[^…]*…/)?.[0];
    expect(truncatedPart).toBeDefined();
    expect(truncatedPart?.length).toBeLessThanOrEqual(28); // COL_MODEL width
  });
});

describe("renderCsv", () => {
  test("renders valid CSV with headers and data rows", () => {
    const result = renderCsv(rows, totals, meta);
    const lines = result.split("\n");

    // Header row
    expect(lines[0]).toContain("Model");
    expect(lines[0]).toContain("Provider");
    expect(lines[0]).toContain("Total Tokens");
    expect(lines[0]).toContain("Cost Total");

    // Data rows (header + 2 models + TOTAL)
    const dataLines = lines.filter((l) => !l.startsWith("#") && l.trim().length > 0);
    expect(dataLines.length).toBe(4); // header + 2 models + total
  });

  test("includes TOTAL row", () => {
    const result = renderCsv(rows, totals, meta);
    expect(result).toContain("TOTAL");
    expect(result).toContain("100000");
  });

  test("includes metadata as comments", () => {
    const result = renderCsv(rows, totals, meta);
    expect(result).toContain("# Token Usage Report");
    expect(result).toContain("# Sessions: 8");
  });

  test("properly quotes values with commas", () => {
    const rowWithComma: ModelStats = {
      model: "my model, v2",
      provider: "my, provider",
      turns: 1,
      inputTokens: 100,
      outputTokens: 50,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      totalTokens: 150,
      costInput: 0,
      costOutput: 0,
      costCacheRead: 0,
      costCacheWrite: 0,
      costTotal: 0,
    };
    const result = renderCsv([rowWithComma], totals, meta);
    expect(result).toContain('"my model, v2"');
    expect(result).toContain('"my, provider"');
  });

  test("uses singular 'day' when daysArg is 1", () => {
    const result = renderCsv(rows, totals, { ...meta, daysArg: 1 });
    expect(result).toContain("(last 1 day)");
    expect(result).not.toContain("(last 1 days)");
  });

  test("shows no window when daysArg is null", () => {
    const result = renderCsv(rows, totals, { ...meta, daysArg: null });
    // CSV metadata comments should not contain "last" or "day"
    const lines = result.split("\n").filter((l) => l.startsWith("#"));
    expect(lines.some((l) => l.includes("last"))).toBe(false);
  });
});

describe("renderJson", () => {
  test("renders valid JSON", () => {
    const result = renderJson(rows, totals, meta);
    const parsed = JSON.parse(result);
    expect(parsed).toBeDefined();
  });

  test("includes meta, models, and totals", () => {
    const result = renderJson(rows, totals, meta);
    const parsed = JSON.parse(result);

    expect(parsed.meta.target).toBe("~/.pi/agent/sessions");
    expect(parsed.meta.window).toBe("last 7 days");
    expect(parsed.meta.sessionCount).toBe(8);
    expect(parsed.models).toHaveLength(2);
    expect(parsed.models[0].model).toBe("claude-sonnet-4-20250514");
    expect(parsed.totals.totalTokens).toBe(100000);
  });

  test("null window when no days filter", () => {
    const result = renderJson(rows, totals, { ...meta, daysArg: null });
    const parsed = JSON.parse(result);
    expect(parsed.meta.window).toBeNull();
  });

  test("uses singular 'day' when daysArg is 1", () => {
    const result = renderJson(rows, totals, { ...meta, daysArg: 1 });
    const parsed = JSON.parse(result);
    expect(parsed.meta.window).toBe("last 1 day");
  });

  test("uses plural 'days' when daysArg is > 1", () => {
    const result = renderJson(rows, totals, { ...meta, daysArg: 2 });
    const parsed = JSON.parse(result);
    expect(parsed.meta.window).toBe("last 2 days");
  });
});

describe("renderMarkdown", () => {
  test("renders a markdown table with pipes", () => {
    const result = renderMarkdown(rows, totals, meta);

    expect(result).toContain("## Token Usage Report");
    expect(result).toContain("claude-sonnet-4-20250514");
    expect(result).toContain("gpt-4o");
    expect(result).toContain("|");
    expect(result).toContain("---:");
    expect(result).toContain("**TOTAL**");
  });

  test("shows empty message when no rows", () => {
    const result = renderMarkdown(
      [],
      {
        turns: 0,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        totalTokens: 0,
        costInput: 0,
        costOutput: 0,
        costCacheRead: 0,
        costCacheWrite: 0,
        costTotal: 0,
      },
      meta,
    );
    expect(result).toContain("No assistant messages");
  });

  test("includes session metadata", () => {
    const result = renderMarkdown(rows, totals, meta);
    expect(result).toContain("**Sessions:** 8");
    expect(result).toContain("**Files:** 12");
  });

  test("uses singular 'day' when daysArg is 1", () => {
    const result = renderMarkdown(rows, totals, { ...meta, daysArg: 1 });
    expect(result).toContain("(last 1 day)");
    expect(result).not.toContain("(last 1 days)");
  });

  test("uses plural 'days' when daysArg is > 1", () => {
    const result = renderMarkdown(rows, totals, { ...meta, daysArg: 2 });
    expect(result).toContain("(last 2 days)");
  });

  test("shows no window when daysArg is null", () => {
    const result = renderMarkdown(rows, totals, { ...meta, daysArg: null });
    expect(result).not.toContain("last");
    expect(result).not.toContain("day");
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Daily renderer test data
// ──────────────────────────────────────────────────────────────────────────────

const dailyRows: DailyModelStats[] = [
  {
    date: "2025-01-15",
    model: "claude-sonnet-4-20250514",
    provider: "anthropic",
    turns: 5,
    inputTokens: 25000,
    outputTokens: 6000,
    cacheReadTokens: 4000,
    cacheWriteTokens: 1000,
    totalTokens: 36000,
    costInput: 0.075,
    costOutput: 0.018,
    costCacheRead: 0.002,
    costCacheWrite: 0.0025,
    costTotal: 0.0975,
  },
  {
    date: "2025-01-15",
    model: "gpt-4o",
    provider: "openai",
    turns: 3,
    inputTokens: 10000,
    outputTokens: 4000,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    totalTokens: 14000,
    costInput: 0.03,
    costOutput: 0.012,
    costCacheRead: 0,
    costCacheWrite: 0,
    costTotal: 0.042,
  },
  {
    date: "2025-01-14",
    model: "claude-sonnet-4-20250514",
    provider: "anthropic",
    turns: 2,
    inputTokens: 10000,
    outputTokens: 3000,
    cacheReadTokens: 2000,
    cacheWriteTokens: 0,
    totalTokens: 15000,
    costInput: 0.03,
    costOutput: 0.009,
    costCacheRead: 0.001,
    costCacheWrite: 0,
    costTotal: 0.04,
  },
];

const dailyTotals: DailyTotals[] = [
  {
    date: "2025-01-15",
    turns: 8,
    inputTokens: 35000,
    outputTokens: 10000,
    cacheReadTokens: 4000,
    cacheWriteTokens: 1000,
    totalTokens: 50000,
    costInput: 0.105,
    costOutput: 0.03,
    costCacheRead: 0.002,
    costCacheWrite: 0.0025,
    costTotal: 0.1395,
  },
  {
    date: "2025-01-14",
    turns: 2,
    inputTokens: 10000,
    outputTokens: 3000,
    cacheReadTokens: 2000,
    cacheWriteTokens: 0,
    totalTokens: 15000,
    costInput: 0.03,
    costOutput: 0.009,
    costCacheRead: 0.001,
    costCacheWrite: 0,
    costTotal: 0.04,
  },
];

const grandTotals: Totals = {
  turns: 10,
  inputTokens: 45000,
  outputTokens: 13000,
  cacheReadTokens: 6000,
  cacheWriteTokens: 1000,
  totalTokens: 65000,
  costInput: 0.135,
  costOutput: 0.039,
  costCacheRead: 0.003,
  costCacheWrite: 0.0025,
  costTotal: 0.1795,
};

describe("renderDailyTable", () => {
  test("renders a daily table with date groups and totals", () => {
    const result = renderDailyTable(dailyRows, dailyTotals, grandTotals, meta);

    expect(result).toContain("Token Usage Report (daily)");
    expect(result).toContain("2025-01-15");
    expect(result).toContain("2025-01-14");
    expect(result).toContain("claude-sonnet-4-20250514");
    expect(result).toContain("gpt-4o");
    expect(result).toContain("GRAND TOTAL");
    expect(result).toContain("2025-01-15 TOTAL");
    expect(result).toContain("2025-01-14 TOTAL");
  });

  test("shows empty message when no rows", () => {
    const result = renderDailyTable(
      [],
      [],
      {
        turns: 0,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        totalTokens: 0,
        costInput: 0,
        costOutput: 0,
        costCacheRead: 0,
        costCacheWrite: 0,
        costTotal: 0,
      },
      meta,
    );
    expect(result).toContain("No assistant messages");
  });

  test("shows window when daysArg is set", () => {
    const result = renderDailyTable(dailyRows, dailyTotals, grandTotals, { ...meta, daysArg: 7 });
    expect(result).toContain("last 7 days");
  });
});

describe("renderDailyCsv", () => {
  test("renders CSV with Date column and daily totals", () => {
    const result = renderDailyCsv(dailyRows, dailyTotals, grandTotals, meta);
    const lines = result.split("\n");

    // Header row includes Date
    expect(lines[0]).toContain("Date");
    expect(lines[0]).toContain("Model");

    // Data + daily TOTAL rows + GRAND TOTAL row
    const dataLines = lines.filter((l) => !l.startsWith("#") && l.trim().length > 0);
    // header + 2 models (Jan 15) + Jan 15 TOTAL + 1 model (Jan 14) + Jan 14 TOTAL + GRAND TOTAL = 7
    expect(dataLines.length).toBe(7);
  });

  test("includes GRAND TOTAL", () => {
    const result = renderDailyCsv(dailyRows, dailyTotals, grandTotals, meta);
    expect(result).toContain("GRAND TOTAL");
    expect(result).toContain("65000");
  });

  test("includes metadata as comments", () => {
    const result = renderDailyCsv(dailyRows, dailyTotals, grandTotals, meta);
    expect(result).toContain("# Token Usage Report (daily)");
  });
});

describe("renderDailyJson", () => {
  test("renders valid JSON with daily structure", () => {
    const result = renderDailyJson(dailyRows, dailyTotals, grandTotals, meta);
    const parsed = JSON.parse(result);

    expect(parsed.meta.daily).toBe(true);
    expect(parsed.meta.target).toBe("~/.pi/agent/sessions");
    expect(parsed.days).toHaveLength(2);
    expect(parsed.days[0].date).toBe("2025-01-15");
    expect(parsed.days[0].models).toHaveLength(2);
    expect(parsed.days[1].date).toBe("2025-01-14");
    expect(parsed.days[1].models).toHaveLength(1);
    expect(parsed.grandTotals.totalTokens).toBe(65000);
  });

  test("null window when no days filter", () => {
    const result = renderDailyJson(dailyRows, dailyTotals, grandTotals, { ...meta, daysArg: null });
    const parsed = JSON.parse(result);
    expect(parsed.meta.window).toBeNull();
  });
});

describe("renderDailyMarkdown", () => {
  test("renders a markdown table with daily groups", () => {
    const result = renderDailyMarkdown(dailyRows, dailyTotals, grandTotals, meta);

    expect(result).toContain("## Token Usage Report (daily)");
    expect(result).toContain("2025-01-15");
    expect(result).toContain("2025-01-14");
    expect(result).toContain("**GRAND TOTAL**");
  });

  test("shows empty message when no rows", () => {
    const result = renderDailyMarkdown(
      [],
      [],
      {
        turns: 0,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        totalTokens: 0,
        costInput: 0,
        costOutput: 0,
        costCacheRead: 0,
        costCacheWrite: 0,
        costTotal: 0,
      },
      meta,
    );
    expect(result).toContain("No assistant messages");
  });

  test("includes session metadata", () => {
    const result = renderDailyMarkdown(dailyRows, dailyTotals, grandTotals, meta);
    expect(result).toContain("**Sessions:** 8");
    expect(result).toContain("**Files:** 12");
  });

  test("shows window when daysArg is set", () => {
    const result = renderDailyMarkdown(dailyRows, dailyTotals, grandTotals, { ...meta, daysArg: 7 });
    expect(result).toContain("last 7 days");
  });
});
