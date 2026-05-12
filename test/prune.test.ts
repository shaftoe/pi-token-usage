import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { rm, mkdir, writeFile, utimes, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parsePruneArgs, pruneSessions, formatPruneReport } from "../src/prune.js";

describe("parsePruneArgs", () => {
  test("throws error for empty input", () => {
    expect(() => parsePruneArgs("", "/cwd")).toThrow("Missing required argument: days");
  });

  test("parses days argument", () => {
    const result = parsePruneArgs("30", "/cwd");
    expect(result.days).toBe(30);
    expect(result.dryRun).toBe(false);
    expect(result.force).toBe(false);
    expect(result.targetPath).toBeDefined();
  });

  test("parses --dry-run flag", () => {
    const result = parsePruneArgs("30 --dry-run", "/cwd");
    expect(result.dryRun).toBe(true);
  });

  test("parses -d shorthand for dry-run", () => {
    const result = parsePruneArgs("30 -d", "/cwd");
    expect(result.dryRun).toBe(true);
  });

  test("parses --force flag", () => {
    const result = parsePruneArgs("30 --force", "/cwd");
    expect(result.force).toBe(true);
  });

  test("parses -f shorthand for force", () => {
    const result = parsePruneArgs("30 -f", "/cwd");
    expect(result.force).toBe(true);
  });

  test("parses --path flag", () => {
    const result = parsePruneArgs("30 --path /custom/dir", "/cwd");
    expect(result.targetPath).toBe("/custom/dir");
  });

  test("parses -p shorthand for path", () => {
    const result = parsePruneArgs("30 -p /custom/dir", "/cwd");
    expect(result.targetPath).toBe("/custom/dir");
  });

  test("parses relative path for --path", () => {
    const result = parsePruneArgs("30 --path ./mydir", "/cwd");
    expect(result.targetPath).toBe("/cwd/mydir");
  });

  test("uses default sessions directory when no path provided", () => {
    const result = parsePruneArgs("30", "/cwd");
    expect(result.targetPath).toContain(".pi");
  });

  test("throws error for missing days argument", () => {
    expect(() => parsePruneArgs("--path /some/dir", "/cwd")).toThrow("Missing required argument: days");
  });

  test("throws error for invalid flags", () => {
    expect(() => parsePruneArgs("30 --invalid", "/cwd")).toThrow("Unknown flag: --invalid");
  });

  test("throws error for multiple positional arguments", () => {
    expect(() => parsePruneArgs("30 dir1 dir2", "/cwd")).toThrow("Multiple path arguments provided");
  });

  test("throws error for --path without value", () => {
    expect(() => parsePruneArgs("30 --path", "/cwd")).toThrow("--path requires a value");
  });

  test("throws error for negative days", () => {
    expect(() => parsePruneArgs("-5", "/cwd")).toThrow("days must be a positive integer");
  });

  test("throws error for zero days", () => {
    expect(() => parsePruneArgs("0", "/cwd")).toThrow("days must be a positive integer");
  });

  test("combines all options", () => {
    const result = parsePruneArgs("60 --dry-run --force --path /custom", "/cwd");
    expect(result.days).toBe(60);
    expect(result.dryRun).toBe(true);
    expect(result.force).toBe(true);
    expect(result.targetPath).toBe("/custom");
  });
});

describe("pruneSessions", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `prune-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  test("deletes files older than specified days", async () => {
    // Create a file that's 40 days old
    const oldFile = join(testDir, "old.jsonl");
    await writeFile(oldFile, '{"type": "session"}');

    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 40);
    await utimes(oldFile, oldDate, oldDate);

    // Create a file that's 10 days old
    const newFile = join(testDir, "new.jsonl");
    await writeFile(newFile, '{"type": "session"}');

    const newDate = new Date();
    newDate.setDate(newDate.getDate() - 10);
    await utimes(newFile, newDate, newDate);

    const result = await pruneSessions({ days: 30, targetPath: testDir, dryRun: false, force: true });

    expect(result.deletedFiles).toHaveLength(1);
    expect(result.deletedFiles).toContain(oldFile);
    expect(result.deletedEmptyFiles).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
    expect(result.scannedFiles).toBe(2);
    expect(result.bytesFreed).toBeGreaterThan(0);
  });

  test("deletes empty files regardless of age", async () => {
    // Create an empty file
    const emptyFile = join(testDir, "empty.jsonl");
    await writeFile(emptyFile, "");

    // Create an old non-empty file
    const oldFile = join(testDir, "old.jsonl");
    await writeFile(oldFile, '{"type": "session"}');

    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 40);
    await utimes(oldFile, oldDate, oldDate);

    const result = await pruneSessions({ days: 30, targetPath: testDir, dryRun: false, force: true });

    expect(result.deletedEmptyFiles).toHaveLength(1);
    expect(result.deletedEmptyFiles).toContain(emptyFile);
    expect(result.deletedFiles).toHaveLength(1);
    expect(result.deletedFiles).toContain(oldFile);
    expect(result.scannedFiles).toBe(2);
    expect(result.bytesFreed).toBeGreaterThan(0);
  });

  test("dry run does not delete files", async () => {
    const oldFile = join(testDir, "old.jsonl");
    await writeFile(oldFile, '{"type": "session"}');

    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 40);
    await utimes(oldFile, oldDate, oldDate);

    const result = await pruneSessions({ days: 30, targetPath: testDir, dryRun: true, force: false });

    expect(result.deletedFiles).toHaveLength(1);
    expect(result.deletedFiles).toContain(oldFile);

    // Verify file still exists
    const content = await readFile(oldFile, "utf-8");
    expect(content).toBe('{"type": "session"}');
    expect(result.scannedFiles).toBe(1);
  });

  test("handles non-existent directory gracefully", async () => {
    const result = await pruneSessions({
      days: 30,
      targetPath: join(testDir, "nonexistent"),
      dryRun: false,
      force: true,
    });

    expect(result.deletedFiles).toHaveLength(0);
    expect(result.deletedEmptyFiles).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
    expect(result.scannedFiles).toBe(0);
    expect(result.bytesFreed).toBe(0);
  });

  test("only processes .jsonl files", async () => {
    const jsonlFile = join(testDir, "session.jsonl");
    await writeFile(jsonlFile, '{"type": "session"}');

    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 40);
    await utimes(jsonlFile, oldDate, oldDate);

    const txtFile = join(testDir, "readme.txt");
    await writeFile(txtFile, "some text");

    const result = await pruneSessions({ days: 30, targetPath: testDir, dryRun: false, force: true });

    expect(result.deletedFiles).toHaveLength(1);
    expect(result.deletedFiles).toContain(jsonlFile);
    expect(result.scannedFiles).toBe(1);
  });

  test("recursively processes subdirectories", async () => {
    const subdir = join(testDir, "subdir");
    await mkdir(subdir);

    const oldFile = join(subdir, "old.jsonl");
    await writeFile(oldFile, '{"type": "session"}');

    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 40);
    await utimes(oldFile, oldDate, oldDate);

    const result = await pruneSessions({ days: 30, targetPath: testDir, dryRun: false, force: true });

    expect(result.deletedFiles).toHaveLength(1);
    expect(result.deletedFiles).toContain(oldFile);
    expect(result.scannedFiles).toBe(1);
  });

  test("returns empty result when no files to delete", async () => {
    const recentFile = join(testDir, "recent.jsonl");
    await writeFile(recentFile, '{"type": "session"}');

    const result = await pruneSessions({ days: 30, targetPath: testDir, dryRun: false, force: true });

    expect(result.deletedFiles).toHaveLength(0);
    expect(result.deletedEmptyFiles).toHaveLength(0);
    expect(result.scannedFiles).toBe(1);
    expect(result.bytesFreed).toBe(0);
  });

  test("throws error when many files would be deleted without --force", async () => {
    // Create 101 old files
    for (let i = 0; i < 101; i++) {
      const file = join(testDir, `old-${i}.jsonl`);
      await writeFile(file, `{"id": ${i}}`);
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 40);
      await utimes(file, oldDate, oldDate);
    }

    await expect(pruneSessions({ days: 30, targetPath: testDir, dryRun: false, force: false })).rejects.toThrow(
      "Would delete 101 files. Use --force to confirm.",
    );
  });

  test("does not throw when many files would be deleted with --force", async () => {
    // Create 101 old files
    for (let i = 0; i < 101; i++) {
      const file = join(testDir, `old-${i}.jsonl`);
      await writeFile(file, `{"id": ${i}}`);
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 40);
      await utimes(file, oldDate, oldDate);
    }

    const result = await pruneSessions({ days: 30, targetPath: testDir, dryRun: false, force: true });
    expect(result.deletedFiles).toHaveLength(101);
    expect(result.scannedFiles).toBe(101);
    expect(result.bytesFreed).toBeGreaterThan(0);
  });

  test("does not throw in dry-run mode even with many files", async () => {
    // Create 101 old files
    for (let i = 0; i < 101; i++) {
      const file = join(testDir, `old-${i}.jsonl`);
      await writeFile(file, `{"id": ${i}}`);
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 40);
      await utimes(file, oldDate, oldDate);
    }

    const result = await pruneSessions({ days: 30, targetPath: testDir, dryRun: true, force: false });
    expect(result.deletedFiles).toHaveLength(101);
    expect(result.scannedFiles).toBe(101);
    expect(result.bytesFreed).toBeGreaterThan(0);
  });
});

describe("formatPruneReport", () => {
  test("formats empty result", () => {
    const result = {
      deletedFiles: [],
      deletedEmptyFiles: [],
      errors: [],
      scannedFiles: 0,
      bytesFreed: 0,
    };
    const report = formatPruneReport(result, { days: 30, targetPath: "/path", dryRun: false, force: true });

    expect(report).toContain("Scanned: 0 file(s)");
    expect(report).toContain("Deleted 0 old session file(s)");
    expect(report).toContain("Deleted 0 empty file(s)");
  });

  test("formats result with deleted files", () => {
    const result = {
      deletedFiles: ["/path/old1.jsonl", "/path/old2.jsonl"],
      deletedEmptyFiles: ["/path/empty.jsonl"],
      errors: [],
      scannedFiles: 3,
      bytesFreed: 512,
    };
    const report = formatPruneReport(result, { days: 30, targetPath: "/path", dryRun: false, force: true });

    expect(report).toContain("Scanned: 3 file(s)");
    expect(report).toContain("Deleted 2 old session file(s)");
    expect(report).toContain("Deleted 1 empty file(s)");
    expect(report).toContain("Space freed: 512 bytes");
    expect(report).toContain("/path/old1.jsonl");
    expect(report).toContain("/path/old2.jsonl");
    expect(report).toContain("/path/empty.jsonl");
  });

  test("formats dry-run result", () => {
    const result = {
      deletedFiles: ["/path/old.jsonl"],
      deletedEmptyFiles: [],
      errors: [],
      scannedFiles: 1,
      bytesFreed: 1024,
    };
    const report = formatPruneReport(result, { days: 30, targetPath: "/path", dryRun: true, force: false });

    expect(report).toContain("dry run");
    expect(report).toContain("Would delete 1 old session file(s)");
    expect(report).toContain("Scanned: 1 file(s)");
  });

  test("formats result with errors", () => {
    const result = {
      deletedFiles: [],
      deletedEmptyFiles: [],
      errors: ["/path/error.jsonl: EACCES"],
      scannedFiles: 1,
      bytesFreed: 0,
    };
    const report = formatPruneReport(result, { days: 30, targetPath: "/path", dryRun: false, force: true });

    expect(report).toContain("Errors (1)");
    expect(report).toContain("/path/error.jsonl: EACCES");
  });

  test("formats large byte counts", () => {
    const result = {
      deletedFiles: ["/path/big.jsonl"],
      deletedEmptyFiles: [],
      errors: [],
      scannedFiles: 1,
      bytesFreed: 5 * 1024 * 1024, // 5 MB
    };
    const report = formatPruneReport(result, { days: 30, targetPath: "/path", dryRun: false, force: true });

    expect(report).toContain("Space freed: 5242880 bytes");
    expect(report).toContain("5120.00 KB");
    expect(report).toContain("5.00 MB");
  });
});
