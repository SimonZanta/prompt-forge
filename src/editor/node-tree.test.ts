import { describe, expect, test } from "bun:test";
import {
  cloneNodes, collectTagNames, countWords, createNode, dedentText, escapeXmlText, findNode, serializeTree,
} from "./node-tree.ts";

const tree = () => ({
  root: "prompt",
  nodes: [
    createNode("context", "Postgres schema."),
    createNode("task", "Find the way.", [createNode("rules", "", [createNode("rule", "don't implement"), createNode("rule", "")])]),
  ],
});

describe("serializeTree", () => {
  test("leaves inline, own text before children, two-space indent", () => {
    expect(serializeTree(tree())).toBe(
`<prompt>
  <context>Postgres schema.</context>
  <task>
    Find the way.
    <rules>
      <rule>don't implement</rule>
      <rule></rule>
    </rules>
  </task>
</prompt>
`);
  });
  test("multi-line text is indented per line and escaped", () => {
    const t = { root: "prompt", nodes: [createNode("sql", "SELECT a\n  FROM b WHERE a <> 1 & c")] };
    expect(serializeTree(t)).toBe(
`<prompt>
  <sql>
    SELECT a
      FROM b WHERE a &lt;> 1 &amp; c
  </sql>
</prompt>
`);
  });
  test("empty tree", () => {
    expect(serializeTree({ root: "prompt", nodes: [] })).toBe("<prompt>\n</prompt>\n");
  });
});

describe("dedentText", () => {
  test("round-trips the indentation the serializer adds", () => {
    expect(dedentText("\n    SELECT a\n      FROM b\n  ")).toBe("SELECT a\n  FROM b");
    expect(dedentText("   single line   ")).toBe("single line");
    expect(dedentText("\n\n")).toBe("");
  });
});

describe("tree helpers", () => {
  test("cloneNodes gives fresh ids and independent subtrees", () => {
    const original = tree().nodes;
    const copy = cloneNodes(original);
    expect(copy[1].children[0].tag).toBe("rules");
    expect(copy[1].id).not.toBe(original[1].id);
    copy[1].children[0].children.pop();
    expect(original[1].children[0].children).toHaveLength(2);
  });
  test("findNode reports siblings, index and parent", () => {
    const nodes = tree().nodes;
    const rule = nodes[1].children[0].children[1];
    const hit = findNode(rule.id, nodes)!;
    expect(hit.index).toBe(1);
    expect(hit.parent!.tag).toBe("rules");
    expect(hit.siblings).toBe(nodes[1].children[0].children);
    expect(findNode("nope", nodes)).toBeNull();
  });
  test("collectTagNames and countWords", () => {
    expect([...collectTagNames(tree().nodes)]).toEqual(["context", "task", "rules", "rule"]);
    expect(countWords("  two   words ")).toBe(2);
    expect(countWords("")).toBe(0);
  });
  test("escapeXmlText leaves > alone", () => {
    expect(escapeXmlText("a < b & c > d")).toBe("a &lt; b &amp; c > d");
  });
});
