# pi-token-usage

A [Pi coding agent](https://pi.dev) extension that analyzes token usage and cost across your session files.

## Installation

```bash
# NPM (recommended)
pi install npm:@alexanderfortin/pi-token-usage

# Git
pi install git:github.com/shaftoe/pi-token-usage

# Or quick-test without installing
pi -e ./pi-token-usage/src/index.ts
```

## Usage

```
/token-report                                  Report all sessions (table in TUI)
/token-report 7                                Last 7 days
/token-report /path/to/dir                     Specific directory or file
/token-report --format csv                     CSV to stdout
/token-report --format csv --save report.csv   Save CSV to file
/token-report 7 --format json                  JSON to stdout
/token-report --format md                      Markdown to stdout
/token-report --format markdown --save out.md  Save Markdown to file
/token-report --format=csv --save=out.csv      Equals-sign syntax also works
```

### Arguments

| Argument | Description |
|----------|-------------|
| `[days]` | Number — show sessions from the last N days |
| `[path]` | Path to a `.jsonl` file or directory (default: `~/.pi/agent/sessions`) |
| `--format, -f` | Output format: `table` (default), `csv`, `json`, `markdown` (alias: `md`) |
| `--save, -s` | Write output to file instead of stdout/TUI |

### Output Formats

**Table** (default) — interactive TUI overlay with styled columns.

**CSV** — machine-readable spreadsheet format. Includes metadata as `#` comment lines.

```csv
Model,Provider,Turns,Input Tokens,Output Tokens,...
claude-sonnet-4-20250514,anthropic,10,50000,12000,...
TOTAL,,15,70000,20000,...
```

**JSON** — structured output with `meta`, `models`, and `totals` sections. Pipe to `jq` for queries.

**Markdown** — pipe-delimited table for notes, PRs, or documentation.

## Development

```bash
cd pi-token-usage
bun install           # Install dependencies
bun run check         # Type-check with tsc
bun run lint          # Lint with eslint
bun run format:check  # Verify formatting
bun run format        # Auto-format with Prettier
bun test              # Run tests
bun test:coverage     # Run tests and show coverage stats
```

## How It Works

1. Scans `~/.pi/agent/sessions` (or given path) for `.jsonl` session files
2. Parses each file, extracting `assistant` messages with `usage` data
3. Aggregates token counts and costs per model+provider
4. Renders in the requested format
