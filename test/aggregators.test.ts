import { describe, test, expect } from "bun:test";
import { StatsAccumulator, DailyStatsAccumulator } from "../src/aggregators.js";

describe("StatsAccumulator", () => {
  test("starts empty", () => {
    const acc = new StatsAccumulator();
    expect(acc.sessions).toBe(0);
    expect(acc.errors).toBe(0);
    expect(acc.getRows()).toHaveLength(0);
  });

  test("addError uses default count of 1", () => {
    const acc = new StatsAccumulator();
    acc.addError();
    expect(acc.errors).toBe(1);
  });

  test("addError accepts custom count", () => {
    const acc = new StatsAccumulator();
    acc.addError(5);
    expect(acc.errors).toBe(5);
  });

  test("accumulates a single message", () => {
    const acc = new StatsAccumulator();
    acc.addAssistantMessage("gpt-4o", "openai", {
      input: 100,
      output: 50,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 150,
      cost: { input: 0.0003, output: 0.00015, total: 0.00045 },
    });

    const rows = acc.getRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.model).toBe("gpt-4o");
    expect(rows[0]!.provider).toBe("openai");
    expect(rows[0]!.turns).toBe(1);
    expect(rows[0]!.inputTokens).toBe(100);
    expect(rows[0]!.outputTokens).toBe(50);
    expect(rows[0]!.totalTokens).toBe(150);
    expect(rows[0]!.costTotal).toBe(0.00045);
  });

  test("separates different models", () => {
    const acc = new StatsAccumulator();
    acc.addAssistantMessage("gpt-4o", "openai", { input: 100, output: 50, totalTokens: 150 });
    acc.addAssistantMessage("claude-sonnet-4-20250514", "anthropic", { input: 200, output: 100, totalTokens: 300 });

    const rows = acc.getRows();
    expect(rows).toHaveLength(2);
  });

  test("merges same provider::model", () => {
    const acc = new StatsAccumulator();
    acc.addAssistantMessage("gpt-4o", "openai", { input: 100, output: 50, totalTokens: 150 });
    acc.addAssistantMessage("gpt-4o", "openai", { input: 200, output: 100, totalTokens: 300 });

    const rows = acc.getRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.turns).toBe(2);
    expect(rows[0]!.inputTokens).toBe(300);
    expect(rows[0]!.outputTokens).toBe(150);
    expect(rows[0]!.totalTokens).toBe(450);
  });

  test("handles missing usage fields as zero", () => {
    const acc = new StatsAccumulator();
    acc.addAssistantMessage("model-a", "prov", {});

    const rows = acc.getRows();
    expect(rows[0]!.inputTokens).toBe(0);
    expect(rows[0]!.outputTokens).toBe(0);
    expect(rows[0]!.totalTokens).toBe(0);
    expect(rows[0]!.costTotal).toBe(0);
  });

  test("handles missing cost fields as zero", () => {
    const acc = new StatsAccumulator();
    acc.addAssistantMessage("model-a", "prov", { input: 100, output: 50, cost: {} });

    const rows = acc.getRows();
    expect(rows[0]!.costInput).toBe(0);
    expect(rows[0]!.costTotal).toBe(0);
  });

  describe("totalTokens calculation (bug fix)", () => {
    test("uses totalTokens when present", () => {
      const acc = new StatsAccumulator();
      acc.addAssistantMessage("m", "p", { input: 100, output: 50, totalTokens: 999 });

      expect(acc.getRows()[0]!.totalTokens).toBe(999);
    });

    test("falls back to input + output when totalTokens missing", () => {
      const acc = new StatsAccumulator();
      acc.addAssistantMessage("m", "p", { input: 100, output: 50 });

      expect(acc.getRows()[0]!.totalTokens).toBe(150);
    });

    test("falls back correctly when input is missing", () => {
      const acc = new StatsAccumulator();
      acc.addAssistantMessage("m", "p", { output: 50 });

      expect(acc.getRows()[0]!.totalTokens).toBe(50);
    });

    test("falls back correctly when output is missing", () => {
      const acc = new StatsAccumulator();
      acc.addAssistantMessage("m", "p", { input: 100 });

      expect(acc.getRows()[0]!.totalTokens).toBe(100);
    });

    test("zero when both input and output missing", () => {
      const acc = new StatsAccumulator();
      acc.addAssistantMessage("m", "p", {});

      expect(acc.getRows()[0]!.totalTokens).toBe(0);
    });
  });

  describe("getTotals", () => {
    test("sums across all models", () => {
      const acc = new StatsAccumulator();
      acc.addAssistantMessage("m1", "p1", { input: 100, output: 50, totalTokens: 150 });
      acc.addAssistantMessage("m2", "p2", { input: 200, output: 100, totalTokens: 300 });

      const totals = acc.getTotals();
      expect(totals.turns).toBe(2);
      expect(totals.inputTokens).toBe(300);
      expect(totals.outputTokens).toBe(150);
      expect(totals.totalTokens).toBe(450);
    });

    test("returns zeros for empty accumulator", () => {
      const acc = new StatsAccumulator();
      const totals = acc.getTotals();
      expect(totals.turns).toBe(0);
      expect(totals.totalTokens).toBe(0);
      expect(totals.costTotal).toBe(0);
    });
  });

  test("getRows sorts by totalTokens descending", () => {
    const acc = new StatsAccumulator();
    acc.addAssistantMessage("small", "p", { input: 10, output: 5, totalTokens: 15 });
    acc.addAssistantMessage("big", "p", { input: 1000, output: 500, totalTokens: 1500 });
    acc.addAssistantMessage("medium", "p", { input: 100, output: 50, totalTokens: 150 });

    const rows = acc.getRows();
    expect(rows[0]!.model).toBe("big");
    expect(rows[1]!.model).toBe("medium");
    expect(rows[2]!.model).toBe("small");
  });
});

describe("DailyStatsAccumulator", () => {
  test("starts empty", () => {
    const acc = new DailyStatsAccumulator();
    expect(acc.sessions).toBe(0);
    expect(acc.errors).toBe(0);
    expect(acc.getRows()).toHaveLength(0);
    expect(acc.getDailyTotals()).toHaveLength(0);
  });

  test("accumulates a single message with date", () => {
    const acc = new DailyStatsAccumulator();
    acc.addAssistantMessage("2025-01-15", "gpt-4o", "openai", {
      input: 100,
      output: 50,
      totalTokens: 150,
      cost: { input: 0.0003, output: 0.00015, total: 0.00045 },
    });

    const rows = acc.getRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.date).toBe("2025-01-15");
    expect(rows[0]!.model).toBe("gpt-4o");
    expect(rows[0]!.turns).toBe(1);
    expect(rows[0]!.totalTokens).toBe(150);
  });

  test("tracks daily totals", () => {
    const acc = new DailyStatsAccumulator();
    acc.addAssistantMessage("2025-01-15", "gpt-4o", "openai", { input: 100, output: 50, totalTokens: 150 });
    acc.addAssistantMessage("2025-01-15", "claude", "anthropic", { input: 200, output: 100, totalTokens: 300 });

    const dailyTotals = acc.getDailyTotals();
    expect(dailyTotals).toHaveLength(1);
    expect(dailyTotals[0]!.date).toBe("2025-01-15");
    expect(dailyTotals[0]!.turns).toBe(2);
    expect(dailyTotals[0]!.totalTokens).toBe(450);
  });

  test("separates different dates", () => {
    const acc = new DailyStatsAccumulator();
    acc.addAssistantMessage("2025-01-15", "gpt-4o", "openai", { input: 100, output: 50, totalTokens: 150 });
    acc.addAssistantMessage("2025-01-14", "gpt-4o", "openai", { input: 200, output: 100, totalTokens: 300 });

    const dailyTotals = acc.getDailyTotals();
    expect(dailyTotals).toHaveLength(2);
    // Sorted descending by date
    expect(dailyTotals[0]!.date).toBe("2025-01-15");
    expect(dailyTotals[1]!.date).toBe("2025-01-14");
  });

  test("merges same date + provider + model", () => {
    const acc = new DailyStatsAccumulator();
    acc.addAssistantMessage("2025-01-15", "gpt-4o", "openai", { input: 100, output: 50, totalTokens: 150 });
    acc.addAssistantMessage("2025-01-15", "gpt-4o", "openai", { input: 200, output: 100, totalTokens: 300 });

    const rows = acc.getRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.turns).toBe(2);
    expect(rows[0]!.totalTokens).toBe(450);
  });

  test("separates same date, different model", () => {
    const acc = new DailyStatsAccumulator();
    acc.addAssistantMessage("2025-01-15", "gpt-4o", "openai", { input: 100, output: 50, totalTokens: 150 });
    acc.addAssistantMessage("2025-01-15", "claude", "anthropic", { input: 200, output: 100, totalTokens: 300 });

    const rows = acc.getRows();
    expect(rows).toHaveLength(2);
  });

  test("getRows sorts by date descending then totalTokens descending", () => {
    const acc = new DailyStatsAccumulator();
    acc.addAssistantMessage("2025-01-14", "small", "p", { input: 10, totalTokens: 10 });
    acc.addAssistantMessage("2025-01-15", "big", "p", { input: 1000, totalTokens: 1000 });
    acc.addAssistantMessage("2025-01-15", "small", "p", { input: 100, totalTokens: 100 });

    const rows = acc.getRows();
    expect(rows[0]!.date).toBe("2025-01-15");
    expect(rows[0]!.model).toBe("big");
    expect(rows[1]!.date).toBe("2025-01-15");
    expect(rows[1]!.model).toBe("small");
    expect(rows[2]!.date).toBe("2025-01-14");
  });

  test("getGrandTotals sums across all dates and models", () => {
    const acc = new DailyStatsAccumulator();
    acc.addAssistantMessage("2025-01-15", "m1", "p1", { input: 100, output: 50, totalTokens: 150 });
    acc.addAssistantMessage("2025-01-14", "m2", "p2", { input: 200, output: 100, totalTokens: 300 });

    const grand = acc.getGrandTotals();
    expect(grand.turns).toBe(2);
    expect(grand.totalTokens).toBe(450);
    expect(grand.inputTokens).toBe(300);
    expect(grand.outputTokens).toBe(150);
  });

  test("getGrandTotals returns zeros when empty", () => {
    const acc = new DailyStatsAccumulator();
    const grand = acc.getGrandTotals();
    expect(grand.turns).toBe(0);
    expect(grand.totalTokens).toBe(0);
  });

  test("handles missing usage fields as zero", () => {
    const acc = new DailyStatsAccumulator();
    acc.addAssistantMessage("2025-01-15", "m", "p", {});

    const rows = acc.getRows();
    expect(rows[0]!.totalTokens).toBe(0);
    expect(rows[0]!.costTotal).toBe(0);
  });
});
