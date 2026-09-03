import { describe, expect, test } from "bun:test";
import { FILL_COLUMN, computeLineFill } from "./line-fill.ts";

const longLine = "  " + Array.from({ length: 30 }, (_, i) => "word" + i).join(" ");

describe("computeLineFill", () => {
  test("wraps a long line at the last space before the fill column and keeps indentation", () => {
    const fill = computeLineFill(longLine, longLine.length);
    expect(fill).not.toBeNull();
    expect(fill!.indent).toBe("  ");
    expect(longLine[fill!.breakIndex]).toBe(" ");
    expect(fill!.breakIndex).toBeLessThanOrEqual(FILL_COLUMN);
    const lines = fill!.newValue.split("\n");
    expect(lines[1].startsWith("  word")).toBe(true);
  });

  test("leaves short lines, tag-only lines, code and mid-line cursors alone", () => {
    expect(computeLineFill("short", 5)).toBeNull();
    expect(computeLineFill("<" + "a".repeat(120) + ">", 122)).toBeNull();
    expect(computeLineFill("```\n" + longLine, 4 + longLine.length)).toBeNull();
    expect(computeLineFill(longLine, 10)).toBeNull();
  });
});
