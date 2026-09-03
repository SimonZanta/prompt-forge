import { TAG_LINK_PATTERN } from "./legacy-xml.ts";
import { TAG_COLOR_COUNT, tagColorIndex } from "./syntax-highlight.ts";

/**
 * Colours `[[tag]]` links inside block text fields with the tag's own colour, using the CSS Custom
 * Highlight API: ranges are painted by `::highlight(link-N)` rules without touching the DOM, which is
 * what a plain-text contenteditable needs. Browsers without the API keep the text uncoloured.
 */

const TEXT_SELECTOR = "[data-text]";

const supported = typeof CSS !== "undefined" && "highlights" in CSS && typeof Highlight !== "undefined";
const highlights: Highlight[] = [];
/** The ranges each field currently contributes, so they can be withdrawn before the field is re-scanned or removed. */
const rangesByField = new WeakMap<HTMLElement, { range: Range; colorIndex: number }[]>();

function ensureRegistered(): void {
  if (!supported || highlights.length) return;
  for (let index = 0; index < TAG_COLOR_COUNT; index++) {
    const highlight = new Highlight();
    highlights.push(highlight);
    CSS.highlights.set("link-" + index, highlight);
  }
}

/** Text nodes of `field` in order, with the offset of each within the field's full text. */
function textNodesOf(field: HTMLElement): { node: Text; start: number }[] {
  const nodes: { node: Text; start: number }[] = [];
  const walker = document.createTreeWalker(field, NodeFilter.SHOW_TEXT);
  let offset = 0;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    nodes.push({ node: node as Text, start: offset });
    offset += (node as Text).data.length;
  }
  return nodes;
}

/** Converts an offset into the concatenated text to a (node, offset) position. */
function positionAt(nodes: { node: Text; start: number }[], offset: number): [Text, number] {
  let last = nodes[0];
  for (const entry of nodes) {
    if (offset < entry.start) break;
    last = entry;
  }
  return [last.node, Math.min(offset - last.start, last.node.data.length)];
}

function withdraw(field: HTMLElement): void {
  for (const { range, colorIndex } of rangesByField.get(field) ?? []) highlights[colorIndex].delete(range);
  rangesByField.delete(field);
}

/** Re-scans one text field (call after its text changed). */
export function updateFieldLinkHighlights(field: HTMLElement): void {
  if (!supported) return;
  ensureRegistered();
  withdraw(field);
  const nodes = textNodesOf(field);
  if (!nodes.length) return;
  const text = nodes.map((entry) => entry.node.data).join("");
  const added: { range: Range; colorIndex: number }[] = [];
  for (const match of text.matchAll(TAG_LINK_PATTERN)) {
    const range = document.createRange();
    const [startNode, startOffset] = positionAt(nodes, match.index);
    const [endNode, endOffset] = positionAt(nodes, match.index + match[0].length);
    range.setStart(startNode, startOffset);
    range.setEnd(endNode, endOffset);
    const colorIndex = tagColorIndex(match[1]);
    highlights[colorIndex].add(range);
    added.push({ range, colorIndex });
  }
  rangesByField.set(field, added);
}

/** Re-scans every text field inside `container` (call after a structural render). */
export function updateLinkHighlights(container: HTMLElement): void {
  if (!supported) return;
  for (const field of container.querySelectorAll<HTMLElement>(TEXT_SELECTOR)) updateFieldLinkHighlights(field);
}

/** Withdraws the ranges of every field inside `container` (call before its fields are replaced). */
export function clearLinkHighlights(container: HTMLElement): void {
  if (!supported) return;
  for (const field of container.querySelectorAll<HTMLElement>(TEXT_SELECTOR)) withdraw(field);
}
