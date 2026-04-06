import type { ExtensionCommandContext } from "@mariozechner/pi-coding-agent";
import { Text, Container } from "@mariozechner/pi-tui";
import type { Theme } from "@mariozechner/pi-coding-agent";

// ──────────────────────────────────────────────────────────────────────────────
// Line styling for TUI overlay
// ──────────────────────────────────────────────────────────────────────────────

export function styleLine(line: string, theme: Theme): string {
  if (line.startsWith("Token Usage Report")) return theme.bold(theme.fg("accent", line));
  if (line.startsWith("─")) return theme.fg("dim", line);
  if (line.startsWith("TOTAL")) return theme.bold(line);
  return line;
}

// ──────────────────────────────────────────────────────────────────────────────
// TUI overlay display
// ──────────────────────────────────────────────────────────────────────────────

export interface TuiComponent {
  render: (width: number) => string[];
  invalidate: () => void;
  handleInput: () => void;
}

export function createTuiComponent(report: string, theme: Theme, done: () => void): TuiComponent {
  const container = new Container();

  const lines = report.split("\n");
  for (const line of lines) {
    container.addChild(new Text(styleLine(line, theme), 0, 0));
  }
  container.addChild(new Text(theme.fg("dim", "  [press any key to close]"), 0, 0));

  return {
    render: (w: number) => container.render(w),
    invalidate: () => container.invalidate(),
    handleInput: () => {
      done();
    },
  };
}

export async function showTuiOverlay(report: string, ctx: ExtensionCommandContext): Promise<void> {
  await ctx.ui.custom<void>((_tui, theme, _kb, done) => {
    return createTuiComponent(report, theme, done);
  });
}
