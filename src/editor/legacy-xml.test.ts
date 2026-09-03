import { describe, expect, test } from "bun:test";
import { migrateLegacyXml } from "./legacy-xml.ts";

describe("migrateLegacyXml", () => {
  test("backtick tag references become links", () => {
    expect(migrateLegacyXml("<context>look at `<example>` and `<task_description>`</context>"))
      .toBe("<context>look at [[example]] and [[task_description]]</context>");
  });
  test("other code spans and fences are escaped losslessly", () => {
    expect(migrateLegacyXml("<a>use `x < 1 && y` here</a>")).toBe("<a>use `x &lt; 1 &amp;&amp; y` here</a>");
    expect(migrateLegacyXml("<a>\n```xml\n<b>&</b>\n```\n</a>")).toBe("<a>\n```xml\n&lt;b>&amp;&lt;/b>\n```\n</a>");
  });
  test("stray < and bare & outside code", () => {
    expect(migrateLegacyXml("<sql>a <> b AND c < (1) & d &amp; e &#39;</sql>"))
      .toBe("<sql>a &lt;> b AND c &lt; (1) &amp; d &amp; e &#39;</sql>");
  });
  test("well-formed markup is untouched", () => {
    const xml = "<prompt>\n  <task name=\"x\">text</task>\n  <!-- c -->\n  <?pi ?>\n</prompt>";
    expect(migrateLegacyXml(xml)).toBe(xml);
  });
});
