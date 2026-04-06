import type { ModelStats, Totals, UsageInfo } from "./types.js";

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
