// ──────────────────────────────────────────────────────────────────────────────
// JSONL session file types
// ──────────────────────────────────────────────────────────────────────────────

export interface SessionEntry {
  type: "session";
  id: string;
  timestamp: string;
  provider?: string;
  modelId?: string;
}

export interface UsageCost {
  input?: number;
  output?: number;
  cacheRead?: number;
  cacheWrite?: number;
  total?: number;
}

export interface UsageInfo {
  input?: number;
  output?: number;
  cacheRead?: number;
  cacheWrite?: number;
  totalTokens?: number;
  cost?: UsageCost;
}

export interface AssistantMessagePayload {
  role: "assistant";
  model?: string;
  provider?: string;
  usage?: UsageInfo;
}

export interface OtherMessagePayload {
  role: string;
}

export interface MessageEntry {
  type: "message";
  timestamp: string;
  message: AssistantMessagePayload | OtherMessagePayload;
}

export type JsonlEntry = SessionEntry | MessageEntry | { type: string };

// ──────────────────────────────────────────────────────────────────────────────
// Aggregation types
// ──────────────────────────────────────────────────────────────────────────────

export interface ModelStats {
  model: string;
  provider: string;
  turns: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  totalTokens: number;
  costInput: number;
  costOutput: number;
  costCacheRead: number;
  costCacheWrite: number;
  costTotal: number;
}

export type Totals = Omit<ModelStats, "model" | "provider">;

// ──────────────────────────────────────────────────────────────────────────────
// Report metadata (passed to all renderers)
// ──────────────────────────────────────────────────────────────────────────────

export interface ReportMeta {
  sessionCount: number;
  fileCount: number;
  errorCount: number;
  daysArg: number | null;
  targetDesc: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// Parsed CLI arguments
// ──────────────────────────────────────────────────────────────────────────────

export type OutputFormat = "table" | "csv" | "json" | "markdown";

export interface ParsedArgs {
  daysArg: number | null;
  targetPath: string;
  targetDesc: string;
  format: OutputFormat;
  savePath: string | null;
}
