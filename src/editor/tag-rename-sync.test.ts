import { describe, expect, test } from "bun:test";
import { computePartnerRename, findChangedRange, findEditedTagName } from "./tag-rename-sync.ts";

describe("findChangedRange", () => {
  test("finds a single edit region", () => {
    expect(findChangedRange("abc", "abXc")).toEqual({ start: 2, removedCount: 0, insertedCount: 1 });
    expect(findChangedRange("abc", "abc")).toBeNull();
  });
});

describe("findEditedTagName", () => {
  test("recognises opening and closing tag names", () => {
    expect(findEditedTagName("<abc>", 2, 1)).toMatchObject({ name: "abc", isClosing: false });
    expect(findEditedTagName("</abc>", 3, 1)).toMatchObject({ name: "abc", isClosing: true });
    expect(findEditedTagName("plain abc", 7, 1)).toBeNull();
  });
});

describe("computePartnerRename", () => {
  test("renames the closing tag when the opening tag is edited", () => {
    const rename = computePartnerRename("<ab>x</ab>", "<abc>x</ab>");
    expect(rename).toEqual({ start: 8, end: 10, name: "abc" });
  });

  test("renames the opening tag when the closing tag is edited", () => {
    const rename = computePartnerRename("<ab>x</ab>", "<ab>x</a>");
    expect(rename).toEqual({ start: 1, end: 3, name: "a" });
  });

  test("ignores edits outside tag names and unmatched tags", () => {
    expect(computePartnerRename("<ab>x</ab>", "<ab>xy</ab>")).toBeNull();
    expect(computePartnerRename("<ab>x", "<abc>x")).toBeNull();
  });
});
