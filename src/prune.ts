/**
 * Token Prune Command
 *
 * /token-prune <days> [--dry-run] [--force] [--path <dir>]
 *
 * Deletes .jsonl session files older than <days> days (based on modification time).
 * Also removes empty .jsonl files (0 bytes) regardless of age.
 *
 * Examples:
 *   /token-prune 30              — delete sessions older than 30 days
 *   /token-prune 30 --dry-run    — preview what would be deleted
 *   /token-prune 60 --force      — skip confirmation prompt
 *   /token-prune 60 --path /custom/dir — prune a specific directory
 */

import { stat, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { Temporal } from "@js-temporal/polyfill";
import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { DEFAULT_SESSIONS_DIR } from "./utils.js";
import { collectJsonlFiles } from "./parser.js";
import { showTuiOverlay } from "./ui.js";

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export interface PruneOptions {
  days: number;
  targetPath: string;
  dryRun: boolean;
  force: boolean;
}

export interface PruneResult {
  deletedFiles: string[];
  deletedEmptyFiles: string[];
  errors: string[];
  scannedFiles: number;
  bytesFreed: number;
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
 * Parse prune arguments
 */
export function parsePruneArgs(rawArgs: string, cwd: string): PruneOptions {
  const tokens = rawArgs.trim().split(/\s+/).filter(Boolean);

  let days: number | null = null;
  let targetPath: string | null = null;
  let dryRun = false;
  let force = false;

  let i = 0;
  while (i < tokens.length) {
    const tok = tokens[i]!;

    if (tok === "--dry-run" || tok === "-d") {
      dryRun = true;
    } else if (tok === "--force" || tok === "-f") {
      force = true;
    } else if (tok === "--path" || tok === "-p") {
      const next = tokens[++i];
      if (!next) {
        throw new Error("--path requires a value");
      }
      targetPath = resolve(cwd, next);
    } else if (/^-?\d+$/.test(tok)) {
      const num = parseInt(tok, 10);
      if (num <= 0) {
        throw new Error("days must be a positive integer");
      }
      days = num;
    } else if (tok.startsWith("--")) {
      throw new Error(`Unknown flag: ${tok}`);
    } else {
      // Positional: treat as path
      if (targetPath !== null) {
        throw new Error("Multiple path arguments provided");
      }
      targetPath = resolve(cwd, tok);
    }

    i++;
  }

  if (days === null) {
    throw new Error("Missing required argument: days");
  }

  if (days <= 0) {
    throw new Error("days must be a positive integer");
  }

  if (!targetPath) {
    targetPath = DEFAULT_SESSIONS_DIR();
  }

  return { days, targetPath, dryRun, force };
}

/**
 * Execute the prune operation
 */
export async function pruneSessions(options: PruneOptions): Promise<PruneResult> {
  const result: PruneResult = {
    deletedFiles: [],
    deletedEmptyFiles: [],
    errors: [],
    scannedFiles: 0,
    bytesFreed: 0,
  };

  const cutoffMs = Temporal.Now.zonedDateTimeISO().subtract({ days: options.days }).toInstant().epochMilliseconds;
  const files = await collectJsonlFiles(options.targetPath);
  result.scannedFiles = files.length;

  // Safety check: abort if too many files would be deleted without --force
  const filesToDelete = [];
  for (const file of files) {
    try {
      const empty = await isEmptyFile(file);
      const old = !empty ? await isFileOld(file, cutoffMs) : false;
      if (empty || old) {
        filesToDelete.push({ file, empty });
      }
    } catch {
      // Will handle in main loop
    }
  }

  if (filesToDelete.length > 100 && !options.force && !options.dryRun) {
    throw new Error(`Would delete ${filesToDelete.length} files. Use --force to confirm.`);
  }

  // Calculate total bytes that would be freed
  for (const { file } of filesToDelete) {
    try {
      const s = await stat(file);
      result.bytesFreed += s.size;
    } catch {
      // Ignore stat errors for byte count
    }
  }

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
  lines.push("-".repeat(60));
  lines.push(`Scanned: ${result.scannedFiles} file(s)`);
  lines.push(`${prefix} ${result.deletedFiles.length} old session file(s)`);
  lines.push(`${prefix} ${result.deletedEmptyFiles.length} empty file(s)`);

  // Format bytes freed
  const bytesFreed = result.bytesFreed;
  if (bytesFreed > 0) {
    const mb = (bytesFreed / (1024 * 1024)).toFixed(2);
    const kb = (bytesFreed / 1024).toFixed(2);
    lines.push(`Space freed: ${bytesFreed} bytes (${kb} KB, ${mb} MB)`);
  }

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

// ──────────────────────────────────────────────────────────────────────────────
// Prune command handler
// ──────────────────────────────────────────────────────────────────────────────

export async function handlePrune(args: string, ctx: ExtensionCommandContext): Promise<void> {
  try {
    const options = parsePruneArgs(args, ctx.cwd);
    const action = options.dryRun ? "Scanning (dry run)" : "Pruning";
    ctx.ui.notify(`${action} sessions older than ${options.days} days…`, "info");

    const result = await pruneSessions(options);
    const report = formatPruneReport(result, options);

    if (ctx.hasUI) {
      await showTuiOverlay(report, ctx);
    } else {
      console.log(report);
    }

    const totalDeleted = result.deletedFiles.length + result.deletedEmptyFiles.length;
    const prefix = options.dryRun ? "Would delete" : "Deleted";
    ctx.ui.notify(`${prefix} ${totalDeleted} file(s).`, "info");
  } catch (err) {
    ctx.ui.notify(`Prune failed: ${(err as Error).message}`, "error");
  }
}
