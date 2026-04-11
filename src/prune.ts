/**
 * Token Prune Command
 *
 * /token-prune [days] [--dry-run] [--path path]
 *
 * Deletes session files older than a specified number of days.
 * Also removes empty .jsonl files.
 *
 * Examples:
 *   /token-prune 30                    — delete sessions older than 30 days
 *   /token-prune 30 --dry-run          — show what would be deleted
 *   /token-prune 30 --path /custom/dir — prune a specific directory
 */

import { stat, unlink, readdir } from "node:fs/promises";
import { join, extname, resolve } from "node:path";
import { Temporal } from "@js-temporal/polyfill";
import { DEFAULT_SESSIONS_DIR } from "./utils.js";

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export interface PruneOptions {
  days: number;
  targetPath: string;
  dryRun: boolean;
}

export interface PruneResult {
  deletedFiles: string[];
  deletedEmptyFiles: string[];
  errors: string[];
}

// ──────────────────────────────────────────────────────────────────────────────
// Prune logic
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Check if a file is empty (0 bytes)
 */
async function isEmptyFile(filePath: string): Promise<boolean> {
  try {
    const s = await stat(filePath);
    return s.size === 0;
  } catch {
    return false;
  }
}

/**
 * Check if a file was modified before the cutoff date
 */
async function isFileOld(filePath: string, cutoffMs: number): Promise<boolean> {
  try {
    const s = await stat(filePath);
    return s.mtimeMs < cutoffMs;
  } catch {
    return false;
  }
}

/**
 * Collect all .jsonl files in a directory (recursively)
 */
async function collectJsonlFiles(dirPath: string): Promise<string[]> {
  const files: string[] = [];
  let entries;

  try {
    entries = await readdir(dirPath, { withFileTypes: true });
  } catch {
    return files;
  }

  for (const e of entries) {
    const full = join(dirPath, e.name);
    if (e.isDirectory()) {
      const sub = await collectJsonlFiles(full);
      files.push(...sub);
    } else if (e.isFile() && extname(e.name) === ".jsonl") {
      files.push(full);
    }
  }

  return files;
}

/**
 * Parse prune arguments
 */
export function parsePruneArgs(rawArgs: string, cwd: string): PruneOptions | null {
  const tokens = rawArgs.trim().split(/\s+/).filter(Boolean);

  let days: number | null = null;
  let targetPath: string | null = null;
  let dryRun = false;

  let i = 0;
  while (i < tokens.length) {
    const tok = tokens[i]!;

    if (tok === "--dry-run" || tok === "-d") {
      dryRun = true;
    } else if (tok === "--path" || tok === "-p") {
      const next = tokens[++i];
      if (!next) {
        return null;
      }
      targetPath = resolve(cwd, next);
    } else if (/^\d+$/.test(tok)) {
      days = parseInt(tok, 10);
    } else if (tok.startsWith("--")) {
      // Reject unknown flags
      return null;
    } else {
      // Positional: treat as path
      if (targetPath !== null) {
        return null;
      }
      targetPath = resolve(cwd, tok);
    }

    i++;
  }

  if (days === null) {
    return null;
  }

  if (!targetPath) {
    targetPath = DEFAULT_SESSIONS_DIR();
  }

  return { days, targetPath, dryRun };
}

/**
 * Execute the prune operation
 */
export async function pruneSessions(options: PruneOptions): Promise<PruneResult> {
  const result: PruneResult = {
    deletedFiles: [],
    deletedEmptyFiles: [],
    errors: [],
  };

  const cutoffMs = Temporal.Now.zonedDateTimeISO().subtract({ days: options.days }).toInstant().epochMilliseconds;
  const files = await collectJsonlFiles(options.targetPath);

  for (const file of files) {
    try {
      // Check if file is empty first
      const empty = await isEmptyFile(file);

      if (empty) {
        if (!options.dryRun) {
          await unlink(file);
        }
        result.deletedEmptyFiles.push(file);
        continue;
      }

      // Check if file is old
      const old = await isFileOld(file, cutoffMs);

      if (old) {
        if (!options.dryRun) {
          await unlink(file);
        }
        result.deletedFiles.push(file);
      }
    } catch (err) {
      result.errors.push(`${file}: ${(err as Error).message}`);
    }
  }

  return result;
}

/**
 * Generate a human-readable report of the prune operation
 */
export function formatPruneReport(result: PruneResult, options: PruneOptions): string {
  const prefix = options.dryRun ? "Would delete" : "Deleted";

  const lines: string[] = [];
  lines.push(`Session Prune Report (${options.dryRun ? "dry run" : "executed"})`);
  lines.push("─".repeat(60));
  lines.push(`${prefix} ${result.deletedFiles.length} old session file(s)`);
  lines.push(`${prefix} ${result.deletedEmptyFiles.length} empty file(s)`);

  if (result.errors.length > 0) {
    lines.push(`\nErrors (${result.errors.length}):`);
    for (const err of result.errors) {
      lines.push(`  ${err}`);
    }
  }

  if (result.deletedFiles.length > 0) {
    lines.push("\nOld files:");
    for (const f of result.deletedFiles) {
      lines.push(`  ${f}`);
    }
  }

  if (result.deletedEmptyFiles.length > 0) {
    lines.push("\nEmpty files:");
    for (const f of result.deletedEmptyFiles) {
      lines.push(`  ${f}`);
    }
  }

  return lines.join("\n");
}
