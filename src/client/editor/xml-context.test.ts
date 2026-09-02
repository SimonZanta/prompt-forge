import { describe, expect, test } from "bun:test";
import { collectOpenTagStack, collectTags, findPartnerTag, isInsideCodeContext, stripCodeSpans } from "./xml-context.ts";

describe("isInsideCodeContext", () => {
  test("detects open fenced block and inline code", () => {
    expect(isInsideCodeContext("a\n```js\nfoo")).toBe(true);
    expect(isInsideCodeContext("a\n```js\nfoo\n```\nbar")).toBe(false);
    expect(isInsideCodeContext("text `code")).toBe(true);
    expect(isInsideCodeContext("text `code` more")).toBe(false);
  });
});

describe("stripCodeSpans", () => {
  test("removes fenced and inline code", () => {
    expect(stripCodeSpans("<a>\n```\n<b>\n```\n`<c>`<d>")).toBe("<a>\n\n<d>");
  });
});

describe("collectOpenTagStack", () => {
  test("tracks nesting and ignores self-closing tags", () => {
    expect(collectOpenTagStack("<a><b/><c>")).toEqual(["a", "c"]);
    expect(collectOpenTagStack("<a><c></c>")).toEqual(["a"]);
    expect(collectOpenTagStack("<a>\n```\n<x>\n```")).toEqual(["a"]);
  });
});

describe("collectTags / findPartnerTag", () => {
  test("pairs nested tags of the same name", () => {
    const tags = collectTags("<a><a></a></a>");
    expect(tags).toHaveLength(4);
    expect(findPartnerTag(tags, 0)).toBe(tags[3]);
    expect(findPartnerTag(tags, 2)).toBe(tags[1]);
    expect(findPartnerTag(collectTags("<a>"), 0)).toBeNull();
  });
});
