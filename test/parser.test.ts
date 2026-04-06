import { describe, test, expect } from "bun:test";
import { parseJsonlFile, collectJsonlFiles, scanAndAggregate } from "../src/parser.js";
import { StatsAccumulator } from "../src/aggregators.js";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, "fixtures");

describe("parseJsonlFile", () => {
  test("parses a valid single-model session file", async () => {
    const acc = new StatsAccumulator();
    await parseJsonlFile(join(FIXTURES, "sample.jsonl"), acc, null);

    expect(acc.sessions).toBe(1);
    expect(acc.errors).toBe(0);

    const rows = acc.getRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.model).toBe("claude-sonnet-4-20250514");
    expect(rows[0]!.provider).toBe("anthropic");
    expect(rows[0]!.turns).toBe(2);
    expect(rows[0]!.inputTokens).toBe(450);
    expect(rows[0]!.outputTokens).toBe(280);
    expect(rows[0]!.cacheReadTokens).toBe(150);
    expect(rows[0]!.cacheWriteTokens).toBe(0);
    expect(rows[0]!.totalTokens).toBe(880);
  });

  test("parses a multi-model session file", async () => {
    const acc = new StatsAccumulator();
    await parseJsonlFile(join(FIXTURES, "multi-model.jsonl"), acc, null);

    expect(acc.sessions).toBe(1);
    expect(acc.errors).toBe(0);

    const rows = acc.getRows();
    expect(rows).toHaveLength(2);

    const openai = rows.find((r) => r.model === "gpt-4o")!;
    expect(openai).toBeDefined();
    expect(openai.turns).toBe(2);
    expect(openai.inputTokens).toBe(500);
    expect(openai.outputTokens).toBe(300);

    const claude = rows.find((r) => r.model === "claude-sonnet-4-20250514")!;
    expect(claude).toBeDefined();
    expect(claude.turns).toBe(1);
  });

  test("counts errors for malformed lines", async () => {
    const acc = new StatsAccumulator();
    await parseJsonlFile(join(FIXTURES, "malformed.jsonl"), acc, null);

    expect(acc.sessions).toBe(1);
    expect(acc.errors).toBe(2);

    const rows = acc.getRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.turns).toBe(1);
  });

  test("skips non-assistant messages", async () => {
    const acc = new StatsAccumulator();
    await parseJsonlFile(join(FIXTURES, "sample.jsonl"), acc, null);

    const rows = acc.getRows();
    // User messages are skipped, only 2 assistant messages counted
    expect(rows[0]!.turns).toBe(2);
  });

  test("skips file when mtime is too old", async () => {
    const acc = new StatsAccumulator();
    // Use a future cutoff: only files modified after Jan 1 2030
    await parseJsonlFile(join(FIXTURES, "sample.jsonl"), acc, Date.now() + 86_400_000);

    expect(acc.sessions).toBe(0);
    expect(acc.getRows()).toHaveLength(0);
  });

  test("skips file when stat throws (non-existent file with sinceMs)", async () => {
    const acc = new StatsAccumulator();
    await parseJsonlFile(join(FIXTURES, "nonexistent.jsonl"), acc, 0);

    expect(acc.sessions).toBe(0);
    expect(acc.errors).toBe(0);
    expect(acc.getRows()).toHaveLength(0);
  });

  test("counts error when readFile fails", async () => {
    const acc = new StatsAccumulator();
    // Pass null sinceMs so stat is skipped, but file doesn't exist
    await parseJsonlFile(join(FIXTURES, "nonexistent.jsonl"), acc, null);

    expect(acc.sessions).toBe(0);
    expect(acc.errors).toBe(1);
  });

  test("skips assistant messages without usage field", async () => {
    const acc = new StatsAccumulator();
    await parseJsonlFile(join(FIXTURES, "no-usage.jsonl"), acc, null);

    const rows = acc.getRows();
    // Only 2 messages have usage (one without model, one without provider)
    expect(rows).toHaveLength(2);
  });

  test("uses 'unknown' for assistant messages without model", async () => {
    const acc = new StatsAccumulator();
    await parseJsonlFile(join(FIXTURES, "no-usage.jsonl"), acc, null);

    const rows = acc.getRows();
    const unknownModel = rows.find((r) => r.model === "unknown");
    expect(unknownModel).toBeDefined();
    expect(unknownModel!.provider).toBe("unknown"); // from session entry without provider
  });

  test("uses sessionProvider when assistant message has no provider", async () => {
    const acc = new StatsAccumulator();
    await parseJsonlFile(join(FIXTURES, "no-usage.jsonl"), acc, null);

    const rows = acc.getRows();
    const modelWithoutProvider = rows.find((r) => r.model === "model-without-provider");
    expect(modelWithoutProvider).toBeDefined();
    expect(modelWithoutProvider!.provider).toBe("unknown");
  });

  test("session entry without provider sets sessionProvider to 'unknown'", async () => {
    const acc = new StatsAccumulator();
    await parseJsonlFile(join(FIXTURES, "no-usage.jsonl"), acc, null);

    const rows = acc.getRows();
    expect(rows[0]!.provider).toBe("unknown");
  });

  test("skips non-session, non-message entry types", async () => {
    const acc = new StatsAccumulator();
    await parseJsonlFile(join(FIXTURES, "no-usage.jsonl"), acc, null);

    // The file has a {type: "other"} entry that should be ignored
    expect(acc.errors).toBe(0);
  });

  test("handles blank lines in JSONL files", async () => {
    const acc = new StatsAccumulator();
    await parseJsonlFile(join(FIXTURES, "no-usage.jsonl"), acc, null);

    // The fixture has multiple blank lines; they should be skipped without errors
    expect(acc.errors).toBe(0);
  });
});

describe("collectJsonlFiles", () => {
  test("finds .jsonl files in a directory", async () => {
    const files = await collectJsonlFiles(FIXTURES);
    expect(files.length).toBeGreaterThanOrEqual(3);
    expect(files.every((f) => f.endsWith(".jsonl"))).toBe(true);
  });

  test("recursively finds .jsonl files in subdirectories", async () => {
    const files = await collectJsonlFiles(FIXTURES);
    const nested = files.find((f) => f.includes("subdir"));
    expect(nested).toBeDefined();
    expect(nested!.endsWith("nested.jsonl")).toBe(true);
  });

  test("returns empty for non-existent directory", async () => {
    const files = await collectJsonlFiles(join(FIXTURES, "nonexistent"));
    expect(files).toHaveLength(0);
  });
});

describe("scanAndAggregate", () => {
  test("aggregates all files in fixtures directory", async () => {
    const { acc, fileCount } = await scanAndAggregate(FIXTURES, null);

    expect(fileCount).toBe(5);
    expect(acc.sessions).toBe(5);
    expect(acc.errors).toBe(2);

    const rows = acc.getRows();
    expect(rows.length).toBeGreaterThanOrEqual(2);
  });

  test("throws for non-existent path", async () => {
    await expect(scanAndAggregate("/nonexistent/path", null)).rejects.toThrow("Path not found");
  });

  test("aggregates a single .jsonl file", async () => {
    const singleFile = join(FIXTURES, "sample.jsonl");
    const { acc, fileCount } = await scanAndAggregate(singleFile, null);

    expect(fileCount).toBe(1);
    expect(acc.sessions).toBe(1);
    expect(acc.errors).toBe(0);
  });

  test("returns empty fileCount for non-.jsonl file", async () => {
    // Use package.json which exists but isn't .jsonl
    const { fileCount, acc } = await scanAndAggregate(join(__dirname, "..", "package.json"), null);
    expect(fileCount).toBe(0);
    expect(acc.sessions).toBe(0);
  });
});
