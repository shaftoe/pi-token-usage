import { homedir } from "node:os";
import { resolve } from "node:path";
import type { OutputFormat, ParsedArgs } from "./types.js";

// ──────────────────────────────────────────────────────────────────────────────
// Number formatting
// ──────────────────────────────────────────────────────────────────────────────

export function fmt(n: number, decimals = 0): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: decimals });
}

export function fmtUsd(n: number): string {
  if (n === 0) return "$0.00";
  if (n < 0.001) return `$${n.toFixed(6)}`;
  return `$${n.toFixed(4)}`;
}

// ──────────────────────────────────────────────────────────────────────────────
// CSV quoting
// ──────────────────────────────────────────────────────────────────────────────

export function csvQuote(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// ──────────────────────────────────────────────────────────────────────────────
// Argument parsing
// ──────────────────────────────────────────────────────────────────────────────

export const DEFAULT_SESSIONS_DIR = () => resolve(homedir(), ".pi", "agent", "sessions");

const VALID_FORMATS: OutputFormat[] = ["table", "csv", "json", "markdown"];

function normalizeFormat(raw: string): OutputFormat | null {
  const lower = raw.toLowerCase();
  if (VALID_FORMATS.includes(lower as OutputFormat)) return lower as OutputFormat;
  if (lower === "md") return "markdown";
  return null;
}

export function parseArgs(rawArgs: string, cwd: string): ParsedArgs {
  const tokens = rawArgs.trim().split(/\s+/).filter(Boolean);

  let daysArg: number | null = null;
  let targetPath: string | null = null;
  let targetDesc: string | null = null;
  let format: OutputFormat = "table";
  let savePath: string | null = null;

  let i = 0;
  while (i < tokens.length) {
    const tok = tokens[i]!;

    if (tok === "--format" || tok === "-f") {
      const next = tokens[++i];
      if (!next) throw new Error("--format requires a value (table|csv|json|markdown)");
      const f = normalizeFormat(next);
      if (!f) throw new Error(`Invalid format: "${next}". Use table, csv, json, or markdown.`);
      format = f;
    } else if (tok === "--save" || tok === "-s") {
      const next = tokens[++i];
      if (!next) throw new Error("--save requires a file path");
      savePath = resolve(cwd, next);
    } else if (tok.startsWith("--format=")) {
      const val = tok.slice("--format=".length);
      const f = normalizeFormat(val);
      if (!f) throw new Error(`Invalid format: "${val}". Use table, csv, json, or markdown.`);
      format = f;
    } else if (/^\d+$/.test(tok)) {
      daysArg = parseInt(tok, 10);
    } else {
      // Positional: treat as path
      targetPath = resolve(cwd, tok);
      targetDesc = tok;
    }

    i++;
  }

  if (!targetPath) {
    targetPath = DEFAULT_SESSIONS_DIR();
    targetDesc = "~/.pi/agent/sessions";
  }
  if (!targetDesc) targetDesc = targetPath;

  return { daysArg, targetPath, targetDesc, format, savePath };
}
