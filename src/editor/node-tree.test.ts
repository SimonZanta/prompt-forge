import { describe, expect, test } from "bun:test";
import {
  cloneNodes, collectLinkedTagNames, collectTagNames, countWords, createNode, dedentText, escapeXmlText, findNode,
  renameTagEverywhere, serializeTree,
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
  test("collectLinkedTagNames finds [[links]] at every depth, once each", () => {
    const nodes = [createNode("task", "see [[rules]] and [[context]]", [createNode("note", "again [[rules]], not [[bad name]]")])];
    expect([...collectLinkedTagNames(nodes)]).toEqual(["rules", "context"]);
  });
  test("renameTagEverywhere renames nodes and links, leaves other names alone", () => {
    const nodes = [
      createNode("rule", "first", [createNode("rule", "nested [[rule]]"), createNode("rules", "keep [[rules]]")]),
      createNode("task", "apply [[rule]] and [[rule]]"),
    ];
    expect(renameTagEverywhere(nodes, "rule", "constraint")).toBe(5);
    expect(nodes[0].tag).toBe("constraint");
    expect(nodes[0].children[0].tag).toBe("constraint");
    expect(nodes[0].children[0].text).toBe("nested [[constraint]]");
    expect(nodes[0].children[1].tag).toBe("rules");
    expect(nodes[0].children[1].text).toBe("keep [[rules]]");
    expect(nodes[1].text).toBe("apply [[constraint]] and [[constraint]]");
    expect(renameTagEverywhere(nodes, "nothing", "x")).toBe(0);
    expect(renameTagEverywhere(nodes, "task", "task")).toBe(0);
  });
  test("escapeXmlText leaves > alone", () => {
    expect(escapeXmlText("a < b & c > d")).toBe("a &lt; b &amp; c > d");
  });
});
