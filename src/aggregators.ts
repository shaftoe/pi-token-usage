import type { DailyModelStats, DailyTotals, ModelStats, Totals, UsageInfo } from "./types.js";

// ──────────────────────────────────────────────────────────────────────────────
// Stats accumulator
// ──────────────────────────────────────────────────────────────────────────────

function emptyStats(model: string, provider: string): ModelStats {
  return {
    model,
    provider,
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
  };
}

export class StatsAccumulator {
  private stats = new Map<string, ModelStats>();
  sessions = 0;
  errors = 0;

  addSession(): void {
    this.sessions++;
  }

  addError(count = 1): void {
    this.errors += count;
  }

  addAssistantMessage(model: string, provider: string, usage: UsageInfo): void {
    const key = `${provider}::${model}`;

    if (!this.stats.has(key)) {
      this.stats.set(key, emptyStats(model, provider));
    }

    const s = this.stats.get(key)!;
    const c = usage.cost ?? {};

    s.turns++;
    s.inputTokens += usage.input ?? 0;
    s.outputTokens += usage.output ?? 0;
    s.cacheReadTokens += usage.cacheRead ?? 0;
    s.cacheWriteTokens += usage.cacheWrite ?? 0;
    s.totalTokens += usage.totalTokens ?? (usage.input ?? 0) + (usage.output ?? 0);

    s.costInput += c.input ?? 0;
    s.costOutput += c.output ?? 0;
    s.costCacheRead += c.cacheRead ?? 0;
    s.costCacheWrite += c.cacheWrite ?? 0;
    s.costTotal += c.total ?? 0;
  }

  getRows(): ModelStats[] {
    return Array.from(this.stats.values()).sort((a, b) => b.totalTokens - a.totalTokens);
  }

  getTotals(): Totals {
    const rows = this.getRows();
    return rows.reduce(
      (acc, r) => {
        acc.turns += r.turns;
        acc.inputTokens += r.inputTokens;
        acc.outputTokens += r.outputTokens;
        acc.cacheReadTokens += r.cacheReadTokens;
        acc.cacheWriteTokens += r.cacheWriteTokens;
        acc.totalTokens += r.totalTokens;
        acc.costInput += r.costInput;
        acc.costOutput += r.costOutput;
        acc.costCacheRead += r.costCacheRead;
        acc.costCacheWrite += r.costCacheWrite;
        acc.costTotal += r.costTotal;
        return acc;
      },
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
    );
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Daily stats accumulator (groups by date × model)
// ──────────────────────────────────────────────────────────────────────────────

function emptyDailyStats(date: string, model: string, provider: string): DailyModelStats {
  return {
    date,
    model,
    provider,
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
  };
}

export class DailyStatsAccumulator {
  private stats = new Map<string, DailyModelStats>(); // key: date::provider::model
  private dailyTotals = new Map<string, DailyTotals>(); // key: date
  sessions = 0;
  errors = 0;

  addSession(): void {
    this.sessions++;
  }

  addError(count = 1): void {
    this.errors += count;
  }

  addAssistantMessage(date: string, model: string, provider: string, usage: UsageInfo): void {
    const key = `${date}::${provider}::${model}`;

    if (!this.stats.has(key)) {
      this.stats.set(key, emptyDailyStats(date, model, provider));
    }

    if (!this.dailyTotals.has(date)) {
      this.dailyTotals.set(date, {
        date,
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
      });
    }

    const s = this.stats.get(key)!;
    const t = this.dailyTotals.get(date)!;
    const c = usage.cost ?? {};

    const inputTokens = usage.input ?? 0;
    const outputTokens = usage.output ?? 0;
    const cacheReadTokens = usage.cacheRead ?? 0;
    const cacheWriteTokens = usage.cacheWrite ?? 0;
    const totalTokens = usage.totalTokens ?? inputTokens + outputTokens;

    s.turns++;
    s.inputTokens += inputTokens;
    s.outputTokens += outputTokens;
    s.cacheReadTokens += cacheReadTokens;
    s.cacheWriteTokens += cacheWriteTokens;
    s.totalTokens += totalTokens;
    s.costInput += c.input ?? 0;
    s.costOutput += c.output ?? 0;
    s.costCacheRead += c.cacheRead ?? 0;
    s.costCacheWrite += c.cacheWrite ?? 0;
    s.costTotal += c.total ?? 0;

    t.turns++;
    t.inputTokens += inputTokens;
    t.outputTokens += outputTokens;
    t.cacheReadTokens += cacheReadTokens;
    t.cacheWriteTokens += cacheWriteTokens;
    t.totalTokens += totalTokens;
    t.costInput += c.input ?? 0;
    t.costOutput += c.output ?? 0;
    t.costCacheRead += c.cacheRead ?? 0;
    t.costCacheWrite += c.cacheWrite ?? 0;
    t.costTotal += c.total ?? 0;
  }

  getRows(): DailyModelStats[] {
    return Array.from(this.stats.values()).sort((a, b) => {
      // Sort by date descending, then totalTokens descending within each date
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return b.totalTokens - a.totalTokens;
    });
  }

  getDailyTotals(): DailyTotals[] {
    return Array.from(this.dailyTotals.values()).sort((a, b) => b.date.localeCompare(a.date));
  }

  getGrandTotals(): Totals {
    const rows = this.getRows();
    return rows.reduce(
      (acc, r) => {
        acc.turns += r.turns;
        acc.inputTokens += r.inputTokens;
        acc.outputTokens += r.outputTokens;
        acc.cacheReadTokens += r.cacheReadTokens;
        acc.cacheWriteTokens += r.cacheWriteTokens;
        acc.totalTokens += r.totalTokens;
        acc.costInput += r.costInput;
        acc.costOutput += r.costOutput;
        acc.costCacheRead += r.costCacheRead;
        acc.costCacheWrite += r.costCacheWrite;
        acc.costTotal += r.costTotal;
        return acc;
      },
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
    );
  }
}
