import { describe, test, expect } from "bun:test";
import {
  fmt,
  fmtUsd,
  csvQuote,
  parseArgs,
  DEFAULT_SESSIONS_DIR,
  formatDaysSuffix,
  formatDaysLabel,
} from "../src/utils.js";

describe("fmt", () => {
  test("formats integers with commas", () => {
    expect(fmt(1000)).toBe("1,000");
  });

  test("formats with custom decimals", () => {
    expect(fmt(1234.567, 2)).toBe("1,234.57");
  });

  test("formats zero", () => {
    expect(fmt(0)).toBe("0");
  });
});

describe("fmtUsd", () => {
  test("formats zero as $0.00", () => {
    expect(fmtUsd(0)).toBe("$0.00");
  });

  test("formats very small values with 6 decimals", () => {
    expect(fmtUsd(0.0005)).toBe("$0.000500");
  });

  test("formats normal values with 4 decimals", () => {
    expect(fmtUsd(1.5)).toBe("$1.5000");
  });
});

describe("csvQuote", () => {
  test("returns unquoted value when no special characters", () => {
    expect(csvQuote("hello")).toBe("hello");
  });

  test("quotes values with commas", () => {
    expect(csvQuote("a,b")).toBe('"a,b"');
  });

  test("quotes values with double quotes by escaping", () => {
    expect(csvQuote('say "hi"')).toBe('"say ""hi"""');
  });

  test("quotes values with newlines", () => {
    expect(csvQuote("line1\nline2")).toBe('"line1\nline2"');
  });
});

describe("parseArgs", () => {
  test("returns defaults for empty input", () => {
    const result = parseArgs("", "/cwd");
    expect(result.daysArg).toBeNull();
    expect(result.targetPath).toBe(DEFAULT_SESSIONS_DIR());
    expect(result.targetDesc).toBe("~/.pi/agent/sessions");
    expect(result.format).toBe("table");
    expect(result.savePath).toBeNull();
  });

  test("parses numeric arg as daysArg", () => {
    const result = parseArgs("7", "/cwd");
    expect(result.daysArg).toBe(7);
  });

  test("parses relative path positional arg", () => {
    const result = parseArgs("some/path", "/cwd");
    expect(result.targetPath).toBe("/cwd/some/path");
    expect(result.targetDesc).toBe("some/path");
  });

  test("parses absolute path positional arg", () => {
    const result = parseArgs("/some/path", "/cwd");
    expect(result.targetPath).toBe("/some/path");
    expect(result.targetDesc).toBe("/some/path");
  });

  test("parses --format flag", () => {
    const result = parseArgs("--format csv", "/cwd");
    expect(result.format).toBe("csv");
  });

  test("parses -f shorthand for format", () => {
    const result = parseArgs("-f json", "/cwd");
    expect(result.format).toBe("json");
  });

  test("normalizes md to markdown", () => {
    const result = parseArgs("--format md", "/cwd");
    expect(result.format).toBe("markdown");
  });

  test("parses --format= inline value", () => {
    const result = parseArgs("--format=csv", "/cwd");
    expect(result.format).toBe("csv");
  });

  test("throws on --format without value", () => {
    expect(() => parseArgs("--format", "/cwd")).toThrow("--format requires a value");
  });

  test("throws on invalid format", () => {
    expect(() => parseArgs("--format xml", "/cwd")).toThrow("Invalid format");
  });

  test("parses --save flag", () => {
    const result = parseArgs("--save report.csv", "/cwd");
    expect(result.savePath).toBe("/cwd/report.csv");
  });

  test("parses -s shorthand for save", () => {
    const result = parseArgs("-s out.json", "/cwd");
    expect(result.savePath).toBe("/cwd/out.json");
  });

  test("throws on --save without value", () => {
    expect(() => parseArgs("--save", "/cwd")).toThrow("--save requires a file path");
  });

  test("combines days, format, and save", () => {
    const result = parseArgs("30 --format csv --save out.csv", "/cwd");
    expect(result.daysArg).toBe(30);
    expect(result.format).toBe("csv");
    expect(result.savePath).toBe("/cwd/out.csv");
  });

  test("throws on multiple positional arguments", () => {
    expect(() => parseArgs("foo bar", "/cwd")).toThrow("Unexpected argument");
  });
});

describe("formatDaysSuffix", () => {
  test("returns empty string when daysArg is null", () => {
    expect(formatDaysSuffix(null)).toBe("");
  });

  test("returns singular form for 1 day", () => {
    expect(formatDaysSuffix(1)).toBe(" (last 1 day)");
  });

  test("returns plural form for >1 days", () => {
    expect(formatDaysSuffix(7)).toBe(" (last 7 days)");
  });
});

describe("formatDaysLabel", () => {
  test("returns null when daysArg is null", () => {
    expect(formatDaysLabel(null)).toBeNull();
  });

  test("returns singular form for 1 day", () => {
    expect(formatDaysLabel(1)).toBe("last 1 day");
  });

  test("returns plural form for >1 days", () => {
    expect(formatDaysLabel(30)).toBe("last 30 days");
  });
});
