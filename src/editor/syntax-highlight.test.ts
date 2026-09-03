import { describe, expect, test } from "bun:test";
import { escapeHtml, highlightSource, tagColorClass } from "./syntax-highlight.ts";

describe("syntax highlight", () => {
  test("escapes html", () => {
    expect(escapeHtml("<a & b>")).toBe("&lt;a &amp; b&gt;");
  });

  test("tag colour is stable and within range", () => {
    expect(tagColorClass("task")).toBe(tagColorClass("task"));
    expect(tagColorClass("task")).toMatch(/^tg tg-\d$/);
  });

  test("wraps tags, attributes and markdown", () => {
    const html = highlightSource('<a x="1">**b** `c`</a>');
    expect(html).toContain('<span class="at">x</span>=');
    expect(html).toContain('<span class="md-b">**b**</span>');
    expect(html).toContain('<span class="md-c">`c`</span>');
    expect(html).toContain('<span class="pu">&lt;/</span>');
  });

  test("styles fenced blocks as one code span", () => {
    const html = highlightSource("```js\n<x>\n```");
    expect(html.startsWith('<span class="md-cb">')).toBe(true);
    expect(html).not.toContain('class="tg');
  });
});
