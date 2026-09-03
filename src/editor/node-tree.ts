/**
 * The in-memory model behind the block composer: a prompt is a root tag plus a tree of nodes, each
 * with a tag name, its own text and children. On disk a prompt stays an XML string (see README,
 * "Storage"); this module converts both ways. `parse*` uses the browser's DOMParser and therefore
 * only runs in the page; everything else is pure and unit-tested.
 */

export interface PromptNode {
  /** Stable while the tree lives; regenerated on every parse and clone. */
  id: string;
  tag: string;
  text: string;
  children: PromptNode[];
  /** Collapsed / expanded in the block view. UI state, never serialized. */
  open: boolean;
}

export interface PromptTree {
  root: string;
  nodes: PromptNode[];
}

export const DEFAULT_ROOT_TAG = "prompt";

let nextId = 0;
export function createNode(tag: string, text = "", children: PromptNode[] = []): PromptNode {
  return { id: "n" + (++nextId).toString(36) + Math.random().toString(36).slice(2, 6), tag, text, children, open: true };
}

/** Deep copy with fresh ids, so inserting the same block twice yields independent subtrees. */
export function cloneNodes(nodes: PromptNode[]): PromptNode[] {
  return nodes.map((node) => createNode(node.tag, node.text, cloneNodes(node.children)));
}

export interface NodeLocation {
  node: PromptNode;
  /** The sibling list that contains `node`. */
  siblings: PromptNode[];
  index: number;
  parent: PromptNode | null;
}

export function findNode(id: string, nodes: PromptNode[], parent: PromptNode | null = null): NodeLocation | null {
  for (let index = 0; index < nodes.length; index++) {
    const node = nodes[index];
    if (node.id === id) return { node, siblings: nodes, index, parent };
    const hit = findNode(id, node.children, node);
    if (hit) return hit;
  }
  return null;
}

/** Every distinct tag name in the tree, in document order. */
export function collectTagNames(nodes: PromptNode[], into = new Set<string>()): Set<string> {
  for (const node of nodes) {
    into.add(node.tag);
    collectTagNames(node.children, into);
  }
  return into;
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

// ---------- serialization ----------

const INDENT = "  ";
const pad = (depth: number) => INDENT.repeat(depth);

/** Only `&` and `<` need escaping in text; `>` is legal and stays readable (SQL `<>`, arrows). */
export function escapeXmlText(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;");
}

/**
 * Trims blank lines at both ends and removes the indentation shared by every remaining line, so
 * multi-line text read back from an indented file equals what the user typed.
 */
export function dedentText(raw: string): string {
  const lines = raw.replace(/\r\n?/g, "\n").split("\n");
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  if (!lines.length) return "";
  if (lines.length === 1) return lines[0].trim();
  const indents = lines.filter((line) => line.trim()).map((line) => line.match(/^[ \t]*/)![0].length);
  const common = Math.min(...indents);
  return lines.map((line) => line.slice(Math.min(common, line.match(/^[ \t]*/)![0].length)).replace(/[ \t]+$/, "")).join("\n");
}

function serializeText(text: string, depth: number): string {
  const escaped = escapeXmlText(text);
  if (!escaped.includes("\n")) return escaped;
  return escaped.split("\n").map((line) => (line ? pad(depth) + line : "")).join("\n");
}

export function serializeNodes(nodes: PromptNode[], depth: number): string {
  return nodes
    .map((node) => {
      const text = node.text.trim() ? serializeText(node.text.trim(), depth + 1) : "";
      const multiLine = text.includes("\n");
      if (!node.children.length) {
        if (!multiLine) return `${pad(depth)}<${node.tag}>${text}</${node.tag}>`;
        return `${pad(depth)}<${node.tag}>\n${text}\n${pad(depth)}</${node.tag}>`;
      }
      const ownText = text ? "\n" + (multiLine ? text : pad(depth + 1) + text) : "";
      return `${pad(depth)}<${node.tag}>${ownText}\n${serializeNodes(node.children, depth + 1)}\n${pad(depth)}</${node.tag}>`;
    })
    .join("\n");
}

export function serializeTree(tree: PromptTree): string {
  const body = tree.nodes.length ? serializeNodes(tree.nodes, 1) + "\n" : "";
  return `<${tree.root}>\n${body}</${tree.root}>\n`;
}

// ---------- parsing (browser only) ----------

function parseDocument(text: string): Document | null {
  const document = new DOMParser().parseFromString(text, "application/xml");
  return document.getElementsByTagName("parsererror").length ? null : document;
}

function elementToNode(element: Element): PromptNode {
  const children: PromptNode[] = [];
  let ownText = "";
  for (const child of element.childNodes) {
    if (child.nodeType === Node.ELEMENT_NODE) children.push(elementToNode(child as Element));
    else if (child.nodeType === Node.TEXT_NODE || child.nodeType === Node.CDATA_SECTION_NODE) ownText += child.textContent ?? "";
  }
  return createNode(element.tagName, dedentText(ownText), children);
}

/** A whole prompt file. Empty text is an empty `<prompt>`; malformed XML is `null`. */
export function parsePromptXml(text: string): PromptTree | null {
  if (!text.trim()) return { root: DEFAULT_ROOT_TAG, nodes: [] };
  const document = parseDocument(text);
  if (!document || !document.documentElement) return null;
  const root = document.documentElement;
  return { root: root.tagName, nodes: [...root.children].map(elementToNode) };
}

/**
 * A block definition may hold several top-level nodes, which is not a document on its own, so it is
 * parsed inside a throwaway wrapper and only the children are kept.
 */
export function parseFragmentXml(text: string): PromptNode[] | null {
  if (!text.trim()) return [];
  const document = parseDocument(`<fragment>${text}</fragment>`);
  if (!document) return null;
  return [...document.documentElement.children].map(elementToNode);
}

export function emptyTree(): PromptTree {
  return { root: DEFAULT_ROOT_TAG, nodes: [] };
}
