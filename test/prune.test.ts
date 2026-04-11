import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { rm, mkdir, writeFile, utimes } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parsePruneArgs, pruneSessions, formatPruneReport } from "../src/prune.js";

describe("parsePruneArgs", () => {
  test("returns null for empty input", () => {
    const result = parsePruneArgs("", "/cwd");
    expect(result).toBeNull();
  });

  test("parses days argument", () => {
    const result = parsePruneArgs("30", "/cwd");
    expect(result).not.toBeNull();
    expect(result!.days).toBe(30);
    expect(result!.dryRun).toBe(false);
    expect(result!.targetPath).toBeDefined();
  });

  test("parses --dry-run flag", () => {
    const result = parsePruneArgs("30 --dry-run", "/cwd");
    expect(result!.dryRun).toBe(true);
  });

  test("parses -d shorthand for dry-run", () => {
    const result = parsePruneArgs("30 -d", "/cwd");
    expect(result!.dryRun).toBe(true);
  });

  test("parses --path flag", () => {
    const result = parsePruneArgs("30 --path /custom/dir", "/cwd");
    expect(result!.targetPath).toBe("/custom/dir");
  });

  test("parses -p shorthand for path", () => {
    const result = parsePruneArgs("30 -p /custom/dir", "/cwd");
    expect(result!.targetPath).toBe("/custom/dir");
  });

  test("parses relative path for --path", () => {
    const result = parsePruneArgs("30 --path ./mydir", "/cwd");
    expect(result!.targetPath).toBe("/cwd/mydir");
  });

  test("uses default sessions directory when no path provided", () => {
    const result = parsePruneArgs("30", "/cwd");
    expect(result!.targetPath).toContain(".pi");
  });

  test("returns null for missing days argument", () => {
    const result = parsePruneArgs("--path /some/dir", "/cwd");
    expect(result).toBeNull();
  });

  test("returns null for invalid flags", () => {
    const result = parsePruneArgs("30 --invalid", "/cwd");
    expect(result).toBeNull();
  });

  test("returns null for multiple positional arguments", () => {
    const result = parsePruneArgs("30 dir1 dir2", "/cwd");
    expect(result).toBeNull();
  });

  test("returns null for --path without value", () => {
    const result = parsePruneArgs("30 --path", "/cwd");
    expect(result).toBeNull();
  });

  test("combines all options", () => {
    const result = parsePruneArgs("60 --dry-run --path /custom", "/cwd");
    expect(result!.days).toBe(60);
    expect(result!.dryRun).toBe(true);
    expect(result!.targetPath).toBe("/custom");
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

    const result = await pruneSessions({ days: 30, targetPath: testDir, dryRun: false });

    expect(result.deletedFiles).toHaveLength(1);
    expect(result.deletedFiles).toContain(oldFile);
    expect(result.deletedEmptyFiles).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
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

    const result = await pruneSessions({ days: 30, targetPath: testDir, dryRun: false });

    expect(result.deletedEmptyFiles).toHaveLength(1);
    expect(result.deletedEmptyFiles).toContain(emptyFile);
    expect(result.deletedFiles).toHaveLength(1);
    expect(result.deletedFiles).toContain(oldFile);
  });

  test("dry run does not delete files", async () => {
    const oldFile = join(testDir, "old.jsonl");
    await writeFile(oldFile, '{"type": "session"}');

    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 40);
    await utimes(oldFile, oldDate, oldDate);

    const result = await pruneSessions({ days: 30, targetPath: testDir, dryRun: true });

    expect(result.deletedFiles).toHaveLength(1);
    expect(result.deletedFiles).toContain(oldFile);

    // Verify file still exists
    const { readFile } = await import("node:fs/promises");
    const content = await readFile(oldFile, "utf-8");
    expect(content).toBe('{"type": "session"}');
  });

  test("handles non-existent directory gracefully", async () => {
    const result = await pruneSessions({
      days: 30,
      targetPath: join(testDir, "nonexistent"),
      dryRun: false,
    });

    expect(result.deletedFiles).toHaveLength(0);
    expect(result.deletedEmptyFiles).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  test("only processes .jsonl files", async () => {
    const jsonlFile = join(testDir, "session.jsonl");
    await writeFile(jsonlFile, '{"type": "session"}');

    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 40);
    await utimes(jsonlFile, oldDate, oldDate);

    const txtFile = join(testDir, "readme.txt");
    await writeFile(txtFile, "some text");

    const result = await pruneSessions({ days: 30, targetPath: testDir, dryRun: false });

    expect(result.deletedFiles).toHaveLength(1);
    expect(result.deletedFiles).toContain(jsonlFile);
  });

  test("recursively processes subdirectories", async () => {
    const subdir = join(testDir, "subdir");
    await mkdir(subdir);

    const oldFile = join(subdir, "old.jsonl");
    await writeFile(oldFile, '{"type": "session"}');

    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 40);
    await utimes(oldFile, oldDate, oldDate);

    const result = await pruneSessions({ days: 30, targetPath: testDir, dryRun: false });

    expect(result.deletedFiles).toHaveLength(1);
    expect(result.deletedFiles).toContain(oldFile);
  });

  test("returns empty result when no files to delete", async () => {
    const recentFile = join(testDir, "recent.jsonl");
    await writeFile(recentFile, '{"type": "session"}');

    const result = await pruneSessions({ days: 30, targetPath: testDir, dryRun: false });

    expect(result.deletedFiles).toHaveLength(0);
    expect(result.deletedEmptyFiles).toHaveLength(0);
  });
});

describe("formatPruneReport", () => {
  test("formats empty result", () => {
    const result = {
      deletedFiles: [],
      deletedEmptyFiles: [],
      errors: [],
    };
    const report = formatPruneReport(result, { days: 30, targetPath: "/path", dryRun: false });

    expect(report).toContain("Deleted 0 old session file(s)");
    expect(report).toContain("Deleted 0 empty file(s)");
  });

  test("formats result with deleted files", () => {
    const result = {
      deletedFiles: ["/path/old1.jsonl", "/path/old2.jsonl"],
      deletedEmptyFiles: ["/path/empty.jsonl"],
      errors: [],
    };
    const report = formatPruneReport(result, { days: 30, targetPath: "/path", dryRun: false });

    expect(report).toContain("Deleted 2 old session file(s)");
    expect(report).toContain("Deleted 1 empty file(s)");
    expect(report).toContain("/path/old1.jsonl");
    expect(report).toContain("/path/old2.jsonl");
    expect(report).toContain("/path/empty.jsonl");
  });

  test("formats dry-run result", () => {
    const result = {
      deletedFiles: ["/path/old.jsonl"],
      deletedEmptyFiles: [],
      errors: [],
    };
    const report = formatPruneReport(result, { days: 30, targetPath: "/path", dryRun: true });

    expect(report).toContain("dry run");
    expect(report).toContain("Would delete 1 old session file(s)");
  });

  test("formats result with errors", () => {
    const result = {
      deletedFiles: [],
      deletedEmptyFiles: [],
      errors: ["/path/error.jsonl: EACCES"],
    };
    const report = formatPruneReport(result, { days: 30, targetPath: "/path", dryRun: false });

    expect(report).toContain("Errors (1)");
    expect(report).toContain("/path/error.jsonl: EACCES");
  });
});
