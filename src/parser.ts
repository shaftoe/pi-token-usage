import { createReadStream, statSync } from "node:fs";
import { stat, readdir } from "node:fs/promises";
import { join, extname } from "node:path";
import readline from "node:readline";
import type { AssistantMessagePayload, JsonlEntry, MessageEntry, SessionEntry } from "./types.js";
import { StatsAccumulator } from "./aggregators.js";

// ──────────────────────────────────────────────────────────────────────────────
// Type guards
// ──────────────────────────────────────────────────────────────────────────────

function isSessionEntry(entry: JsonlEntry): entry is SessionEntry {
  return entry.type === "session";
}

function isMessageEntry(entry: JsonlEntry): entry is MessageEntry {
  return entry.type === "message";
}

function isAssistantMessage(msg: MessageEntry["message"]): msg is AssistantMessagePayload {
  return msg.role === "assistant";
}

// ──────────────────────────────────────────────────────────────────────────────
// JSONL parsing
// ──────────────────────────────────────────────────────────────────────────────

export async function parseJsonlFile(filePath: string, acc: StatsAccumulator, sinceMs: number | null): Promise<void> {
  // Filter by mtime if a time window was requested
  if (sinceMs !== null) {
    try {
      const s = statSync(filePath);
      if (s.mtimeMs < sinceMs) return;
    } catch {
      return;
    }
  }

  let rl: readline.Interface;
  try {
    rl = readline.createInterface({
      input: createReadStream(filePath),
      crlfDelay: Infinity,
    });
  } catch {
    acc.addError();
    return;
  }

  let sessionProvider = "unknown";
  let counted = false;

  try {
    for await (const line of rl) {
      if (!line.trim()) continue;

      let entry: JsonlEntry;
      try {
        entry = JSON.parse(line) as JsonlEntry;
      } catch {
        acc.addError();
        continue;
      }

      if (isSessionEntry(entry)) {
        if (!counted) {
          acc.addSession();
          counted = true;
        }
        if (entry.provider) sessionProvider = entry.provider;
        continue;
      }

      if (!isMessageEntry(entry)) continue;
      if (!isAssistantMessage(entry.message)) continue;

      const msg = entry.message;
      if (!msg.usage) continue;

      const model = msg.model ?? "unknown";
      const provider = msg.provider ?? sessionProvider;

      acc.addAssistantMessage(model, provider, msg.usage);
    }
  } catch {
    acc.addError();
  } finally {
    rl.close();
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Directory walking
// ──────────────────────────────────────────────────────────────────────────────

export async function collectJsonlFiles(dirPath: string): Promise<string[]> {
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

// ──────────────────────────────────────────────────────────────────────────────
// High-level: collect & parse all files for a given target
// ──────────────────────────────────────────────────────────────────────────────

export async function scanAndAggregate(
  targetPath: string,
  sinceMs: number | null,
): Promise<{ acc: StatsAccumulator; fileCount: number }> {
  const pathStat = await stat(targetPath);
  let files: string[];

  if (pathStat.isFile()) {
    files = extname(targetPath) === ".jsonl" ? [targetPath] : [];
  } else {
    files = await collectJsonlFiles(targetPath);
  }

  const acc = new StatsAccumulator();

  for (const f of files) {
    await parseJsonlFile(f, acc, sinceMs);
  }

  return { acc, fileCount: files.length };
}
