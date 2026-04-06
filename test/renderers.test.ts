import { describe, test, expect } from "bun:test";
import { renderTable } from "../src/renderers/table.js";
import { renderCsv } from "../src/renderers/csv.js";
import { renderJson } from "../src/renderers/json.js";
import { renderMarkdown } from "../src/renderers/markdown.js";
import type { ModelStats, ReportMeta, Totals } from "../src/types.js";

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
