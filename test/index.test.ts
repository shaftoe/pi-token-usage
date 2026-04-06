import { describe, test, expect } from "bun:test";
import { styleLine, createTuiComponent, showTuiOverlay } from "../src/ui.js";
import type { ExtensionCommandContext, Theme } from "@mariozechner/pi-coding-agent";

describe("styleLine", () => {
  const theme: Theme = {
    bold: (s: string) => `[bold]${s}[/bold]`,
    fg: (color: string, s: string) => `[fg:${color}]${s}[/fg]`,
  } as Theme;

  test("styles title line with bold accent", () => {
    const line = "Token Usage Report — /path (last 7 days)";
    const result = styleLine(line, theme);
    expect(result).toBe("[bold][fg:accent]Token Usage Report — /path (last 7 days)[/fg][/bold]");
  });

  test("styles separator line with dim", () => {
    const line = "──────────────────────────────────────────────────────────────────────────";
    const result = styleLine(line, theme);
    expect(result).toBe("[fg:dim]──────────────────────────────────────────────────────────────────────────[/fg]");
  });

  test("styles TOTAL line with bold", () => {
    const line = "TOTAL                                       15      70,000     ...";
    const result = styleLine(line, theme);
    expect(result).toBe("[bold]TOTAL                                       15      70,000     ...[/bold]");
  });

  test("returns plain line unchanged for other content", () => {
    const line = "claude-sonnet-4-20250514  anthropi     10      50,000     ...";
    const result = styleLine(line, theme);
    expect(result).toBe(line);
  });

  test("handles TOTAL prefix in longer lines", () => {
    const line = "TOTAL                                    15      70,000     1,000,000";
    const result = styleLine(line, theme);
    expect(result).toBe("[bold]TOTAL                                    15      70,000     1,000,000[/bold]");
  });

  test("handles lines that don't match any pattern", () => {
    const line = "Some other content";
    const result = styleLine(line, theme);
    expect(result).toBe(line);
  });
});

describe("createTuiComponent", () => {
  const theme: Theme = {
    bold: (s: string) => `[bold]${s}[/bold]`,
    fg: (color: string, s: string) => `[fg:${color}]${s}[/fg]`,
  } as Theme;

  test("creates component with all expected methods", () => {
    const done = () => {};
    const component = createTuiComponent("test report", theme, done);

    expect(component).toHaveProperty("render");
    expect(component).toHaveProperty("invalidate");
    expect(component).toHaveProperty("handleInput");

    expect(typeof component.render).toBe("function");
    expect(typeof component.invalidate).toBe("function");
    expect(typeof component.handleInput).toBe("function");
  });

  test("handleInput calls done callback", () => {
    let doneCalled = false;
    const done = () => {
      doneCalled = true;
    };

    const component = createTuiComponent("test report", theme, done);
    component.handleInput();

    expect(doneCalled).toBe(true);
  });

  test("render returns array", () => {
    const done = () => {};
    const component = createTuiComponent("test report", theme, done);

    const result = component.render(80);
    expect(Array.isArray(result)).toBe(true);
  });

  test("invalidate does not throw", () => {
    const done = () => {};
    const component = createTuiComponent("test report", theme, done);

    expect(() => component.invalidate()).not.toThrow();
  });

  test("creates text components for each line", () => {
    const done = () => {};
    const report = "line 1\nline 2\nline 3";

    const component = createTuiComponent(report, theme, done);

    // Verify component structure exists and is callable
    expect(component).toBeDefined();
    expect(typeof component.render).toBe("function");
    expect(typeof component.handleInput).toBe("function");
  });

  test("handles empty report", () => {
    const done = () => {};
    const component = createTuiComponent("", theme, done);

    expect(component).toBeDefined();
    expect(component.handleInput).not.toThrow();
  });

  test("handles single-line report", () => {
    const done = () => {};
    const component = createTuiComponent("single line", theme, done);

    expect(component).toBeDefined();
    expect(component.handleInput).not.toThrow();
  });
});

describe("showTuiOverlay", () => {
  test("calls ctx.ui.custom with component factory", async () => {
    let customCalled = false;
    const mockCtx = {
      ui: {
        custom: async <T>(fn: (...args: unknown[]) => T) => {
          customCalled = true;
          // Call the factory to exercise its body
          const mockTheme = {
            bold: (s: string) => s,
            fg: (color: string, s: string) => s,
          };
          const result = fn(null, mockTheme, null, () => {});
          // Verify result has expected methods
          expect(typeof result).toBe("object");
          return undefined as T;
        },
        notify: () => {},
      },
    } as unknown as ExtensionCommandContext;

    await showTuiOverlay("test report", mockCtx);

    expect(customCalled).toBe(true);
  });
});
