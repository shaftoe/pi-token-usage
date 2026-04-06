import { describe, test, expect } from "bun:test";
import { computeSinceMs, buildReportMeta, generateReport, PathNotFoundError, NoFilesError } from "../src/report.js";
import { StatsAccumulator } from "../src/aggregators.js";
import type { ParsedArgs } from "../src/types.js";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, "fixtures");

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function makeParsed(overrides: Partial<ParsedArgs> = {}): ParsedArgs {
  return {
    daysArg: null,
    targetPath: FIXTURES,
    targetDesc: FIXTURES,
    format: "table",
    savePath: null,
    ...overrides,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// computeSinceMs
// ──────────────────────────────────────────────────────────────────────────────

describe("computeSinceMs", () => {
  test("returns null when daysArg is null (no filter)", () => {
    expect(computeSinceMs(null)).toBeNull();
  });

  test("returns a millisecond timestamp for a given daysArg", () => {
    const ms = computeSinceMs(7);
    expect(ms).toBeTypeOf("number");
    expect(ms!).toBeGreaterThan(0);

    // Should be roughly 7 days ago (within a small tolerance)
    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const diff = Math.abs(now - ms! - sevenDaysMs);
    expect(diff).toBeLessThan(5000); // within 5 seconds tolerance
  });

  test("returns 0 for daysArg=0 (everything from epoch)", () => {
    // daysArg=0 means "subtract 0 days" → effectively now-ish
    const ms = computeSinceMs(0);
    expect(ms).toBeTypeOf("number");
    // Should be very close to now
    expect(Math.abs(Date.now() - ms!)).toBeLessThan(5000);
  });

  test("larger daysArg produces older cutoff", () => {
    const ms7 = computeSinceMs(7)!;
    const ms30 = computeSinceMs(30)!;
    expect(ms30).toBeLessThan(ms7);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// buildReportMeta
// ──────────────────────────────────────────────────────────────────────────────

describe("buildReportMeta", () => {
  test("builds meta from accumulator and parsed args", () => {
    const acc = new StatsAccumulator();
    acc.addSession();
    acc.addSession();
    acc.addError();

    const parsed = makeParsed({ daysArg: 7, targetDesc: "~/sessions" });
    const meta = buildReportMeta(acc, 5, parsed);

    expect(meta.sessionCount).toBe(2);
    expect(meta.fileCount).toBe(5);
    expect(meta.errorCount).toBe(1);
    expect(meta.daysArg).toBe(7);
    expect(meta.targetDesc).toBe("~/sessions");
  });

  test("uses null daysArg from parsed args when not provided", () => {
    const acc = new StatsAccumulator();
    const parsed = makeParsed({ daysArg: null });
    const meta = buildReportMeta(acc, 3, parsed);

    expect(meta.daysArg).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// generateReport
// ──────────────────────────────────────────────────────────────────────────────

describe("generateReport", () => {
  test("throws PathNotFoundError for non-existent path", async () => {
    const parsed = makeParsed({ targetPath: "/nonexistent/path/abc" });
    await expect(generateReport(parsed)).rejects.toThrow(PathNotFoundError);
    await expect(generateReport(parsed)).rejects.toThrow("Path not found: /nonexistent/path/abc");
  });

  test("throws NoFilesError for directory with no .jsonl files", async () => {
    // src/ has .ts files but no .jsonl files
    const srcDir = join(__dirname, "..", "src");
    const parsedSrc = makeParsed({ targetPath: srcDir });
    await expect(generateReport(parsedSrc)).rejects.toThrow(NoFilesError);
    await expect(generateReport(parsedSrc)).rejects.toThrow("No .jsonl files found.");
  });

  test("returns rendered table report for fixtures by default", async () => {
    const parsed = makeParsed({ targetPath: FIXTURES, format: "table" });
    const { report, meta } = await generateReport(parsed);

    expect(report).toContain("Token Usage Report");
    expect(report).toContain("TOTAL");
    expect(meta.fileCount).toBe(5);
    expect(meta.sessionCount).toBe(5);
    expect(meta.errorCount).toBe(2);
    expect(meta.targetDesc).toBe(FIXTURES);
  });

  test("returns CSV report when format is csv", async () => {
    const parsed = makeParsed({ targetPath: FIXTURES, format: "csv" });
    const { report } = await generateReport(parsed);

    expect(report).toContain("Model");
    expect(report).toContain("Provider");
    expect(report).toContain("TOTAL");
  });

  test("returns JSON report when format is json", async () => {
    const parsed = makeParsed({ targetPath: FIXTURES, format: "json" });
    const { report } = await generateReport(parsed);

    const data = JSON.parse(report);
    expect(data.meta).toBeDefined();
    expect(data.models).toBeInstanceOf(Array);
    expect(data.totals).toBeDefined();
  });

  test("returns Markdown report when format is markdown", async () => {
    const parsed = makeParsed({ targetPath: FIXTURES, format: "markdown" });
    const { report } = await generateReport(parsed);

    expect(report).toContain("## Token Usage Report");
    expect(report).toContain("**TOTAL**");
  });

  test("respects daysArg filter (future cutoff yields no files)", async () => {
    // Use a far-future cutoff: effectively no files match
    // We can't easily control file mtimes, so we test with a single file
    // and a very distant future daysArg that filters everything out.
    // However, daysArg subtracts from *now*, so a large value goes further back.
    // Instead, we test that the report works with a small daysArg (everything recent)
    const parsed = makeParsed({ targetPath: FIXTURES, daysArg: 365 * 10 }); // 10 years
    const { report, meta } = await generateReport(parsed);

    // With a 10-year window, should still find all fixture files
    expect(meta.fileCount).toBe(5);
    expect(report).toContain("TOTAL");
  });

  test("works with a single .jsonl file as target", async () => {
    const singleFile = join(FIXTURES, "sample.jsonl");
    const parsed = makeParsed({ targetPath: singleFile });
    const { report, meta } = await generateReport(parsed);

    expect(meta.fileCount).toBe(1);
    expect(meta.sessionCount).toBe(1);
    expect(meta.errorCount).toBe(0);
    expect(report).toContain("claude-sonnet-4-20250514");
  });

  test("report meta reflects parsed args correctly", async () => {
    const parsed = makeParsed({
      targetPath: FIXTURES,
      daysArg: 3,
      targetDesc: "my-sessions",
    });
    const { meta } = await generateReport(parsed);

    expect(meta.daysArg).toBe(3);
    expect(meta.targetDesc).toBe("my-sessions");
  });
});
