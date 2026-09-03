import { iconButton, svgIcon } from "../shared/icons.ts";
import { clearLinkHighlights, updateFieldLinkHighlights, updateLinkHighlights } from "./link-highlight.ts";
import { countWords, findNode, type NodeLocation, type PromptNode } from "./node-tree.ts";
import { tagColorClass } from "./syntax-highlight.ts";

/**
 * The block composer: renders a list of nodes as nested blocks and edits them in place. Any number of
 * editors can be live at once (the prompt canvas, one per custom block definition in settings), each
 * owning one sibling list.
 *
 * Text edits go straight into the node without re-rendering, so the caret never jumps; only
 * structural changes (toggle, insert, delete, reorder) rebuild the DOM.
 */

export interface BlockEditorOptions {
  /** The top-level nodes this editor edits; read on every render so the caller keeps ownership. */
  getNodes(): PromptNode[];
  /** After a text edit (`"text"`, no re-render) or a structural change (`"structure"`, after re-render). */
  onChange(change: "text" | "structure"): void;
  /** Asked to open the insert menu at `anchor`; picked nodes go under `parentId` or, when null, to the top level. */
  onInsert(anchor: HTMLElement, parentId: string | null): void;
  /** Called when the user types `[[` in a text field; `insertLink` completes it as `[[tag]]`. */
  onLinkRequest?(anchor: HTMLElement, insertLink: (tag: string) => void): void;
  /** Root-level chips use the accent fill (the prompt canvas); definitions in settings pass false. */
  accentRoots?: boolean;
}

export interface BlockEditor {
  readonly element: HTMLElement;
  render(): void;
  /** Appends `nodes` under `parentId` (or at the top level), re-renders and focuses the first text field. */
  insert(parentId: string | null, nodes: PromptNode[]): void;
  focusText(nodeId: string): boolean;
  /** Puts the most recently deleted block back where it was; false when there is nothing to restore. */
  undoDelete(): boolean;
}

interface DeletedBlock {
  parentId: string | null;
  index: number;
  node: PromptNode;
}

const TEXT_SELECTOR = "[data-text]";

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, ...children: (Node | string)[]): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.append(...children);
  return node;
}

/** The block element for `nodeId` that is a direct child of the sibling container holding `id`. */
function blockElementOf(root: HTMLElement, nodeId: string): HTMLElement | null {
  return root.querySelector<HTMLElement>(`[data-node="${nodeId}"]`);
}

/** Text of a contenteditable field: `innerText` turns <br> / block boundaries into newlines. */
function fieldText(field: HTMLElement): string {
  return field.innerText.replace(/\n$/, "");
}

/** The text between the start of `field` and the caret, if the caret is inside it. */
function textBeforeCaret(field: HTMLElement): string | null {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount || !selection.isCollapsed) return null;
  const caret = selection.getRangeAt(0);
  if (!field.contains(caret.startContainer)) return null;
  const range = document.createRange();
  range.setStart(field, 0);
  range.setEnd(caret.startContainer, caret.startOffset);
  return range.toString();
}

export function createBlockEditor(container: HTMLElement, options: BlockEditorOptions): BlockEditor {
  const accentRoots = options.accentRoots !== false;
  let lastDeleted: DeletedBlock | null = null;
  let draggedId: string | null = null;

  const locate = (nodeId: string): NodeLocation | null => findNode(nodeId, options.getNodes());

  function renderNode(node: PromptNode, depth: number): HTMLElement {
    const hasChildren = node.children.length > 0;
    const isLeaf = !hasChildren && !node.text;

    const twist = iconButton("chevronDown", node.open ? "Collapse block" : "Expand block", "twist" + (isLeaf ? " leaf" : ""));
    twist.dataset.action = "toggle";
    twist.setAttribute("aria-expanded", String(node.open));

    // same colour per tag name as the XML view, so a tag is recognisable in both
    const chip = element("span", "tag " + tagColorClass(node.tag) + (depth === 0 && accentRoots ? " root" : ""), node.tag);

    let summary: HTMLElement;
    if (!node.open) {
      summary = element("span", "peek", node.text || (hasChildren ? node.children.length + " nested" : "empty"));
    } else {
      summary = element("span", "meta", hasChildren ? String(node.children.length) : node.text ? countWords(node.text) + " w" : "");
    }

    const grip = iconButton("grip", "Drag to reorder", "iconbtn grip");
    grip.draggable = true;
    const add = iconButton("plus", "Add child block");
    add.dataset.action = "add";
    const remove = iconButton("trash", "Delete block");
    remove.dataset.action = "delete";
    const tools = element("div", "tools", grip, add, remove);

    const head = element("div", "bhead", twist, chip, summary, tools);
    const block = element("div", "block" + (depth ? " nested" : ""), head);
    block.dataset.node = node.id;

    if (node.open) {
      if (!hasChildren || node.text) {
        const text = element("div", "text");
        text.contentEditable = "plaintext-only";
        text.dataset.text = "";
        text.dataset.ph = `Write ${node.tag}…`;
        text.setAttribute("role", "textbox");
        text.setAttribute("aria-label", node.tag + " text");
        text.textContent = node.text;
        block.appendChild(text);
      }
      if (hasChildren) {
        block.appendChild(element("div", "kids", ...node.children.map((child) => renderNode(child, depth + 1))));
      }
    }
    return block;
  }

  function render(): void {
    clearLinkHighlights(container);
    container.replaceChildren(...options.getNodes().map((node) => renderNode(node, 0)));
    const addRow = element("button", "addrow", element("span", "key", "/"), " type to insert a block");
    addRow.type = "button";
    addRow.dataset.action = "add-root";
    container.appendChild(addRow);
    updateLinkHighlights(container);
  }

  function focusText(nodeId: string): boolean {
    const field = blockElementOf(container, nodeId)?.querySelector<HTMLElement>(TEXT_SELECTOR);
    if (!field) return false;
    field.focus();
    return true;
  }

  function structureChanged(focusNodeId?: string, focusPart: "text" | "toggle" = "text"): void {
    render();
    if (focusNodeId) {
      const block = blockElementOf(container, focusNodeId);
      if (focusPart === "toggle") block?.querySelector<HTMLElement>('[data-action="toggle"]')?.focus();
      else focusText(focusNodeId);
    }
    options.onChange("structure");
  }

  function insert(parentId: string | null, nodes: PromptNode[]): void {
    if (!nodes.length) return;
    if (parentId) {
      const hit = locate(parentId);
      if (!hit) return;
      hit.node.children.push(...nodes);
      hit.node.open = true;
    } else {
      options.getNodes().push(...nodes);
    }
    structureChanged(nodes[0].id);
    // a container with no text has no field of its own: focus its first descendant field instead
    if (document.activeElement === document.body || !container.contains(document.activeElement)) {
      blockElementOf(container, nodes[0].id)?.querySelector<HTMLElement>(TEXT_SELECTOR)?.focus();
    }
  }

  function deleteNode(hit: NodeLocation): void {
    hit.siblings.splice(hit.index, 1);
    lastDeleted = { parentId: hit.parent?.id ?? null, index: hit.index, node: hit.node };
    const neighbour = hit.siblings[Math.min(hit.index, hit.siblings.length - 1)];
    structureChanged(neighbour?.id ?? hit.parent?.id, "toggle");
  }

  function undoDelete(): boolean {
    if (!lastDeleted) return false;
    const { parentId, index, node } = lastDeleted;
    const siblings = parentId ? locate(parentId)?.node.children : options.getNodes();
    if (!siblings) return false;
    siblings.splice(Math.min(index, siblings.length), 0, node);
    lastDeleted = null;
    structureChanged(node.id, "toggle");
    return true;
  }

  // ---------- events (delegated on the container) ----------

  container.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const actionElement = target.closest<HTMLElement>("[data-action]");
    if (!actionElement || !container.contains(actionElement)) return;
    const action = actionElement.dataset.action;
    if (action === "add-root") return options.onInsert(actionElement, null);
    const block = actionElement.closest<HTMLElement>("[data-node]");
    const hit = block && locate(block.dataset.node!);
    if (!hit) return;
    if (action === "toggle") { hit.node.open = !hit.node.open; structureChanged(hit.node.id, "toggle"); }
    else if (action === "add") options.onInsert(actionElement, hit.node.id);
    else if (action === "delete") deleteNode(hit);
  });

  container.addEventListener("input", (event) => {
    const field = (event.target as HTMLElement).closest<HTMLElement>(TEXT_SELECTOR);
    if (!field) return;
    const block = field.closest<HTMLElement>("[data-node]");
    const hit = block && locate(block.dataset.node!);
    if (!hit) return;
    hit.node.text = fieldText(field);
    updateFieldLinkHighlights(field);
    const meta = block.querySelector<HTMLElement>(":scope > .bhead > .meta");
    if (meta && !hit.node.children.length) meta.textContent = hit.node.text ? countWords(hit.node.text) + " w" : "";
    options.onChange("text");

    if (options.onLinkRequest && textBeforeCaret(field)?.endsWith("[[")) {
      // remember where `[[` ends now: the menu takes focus, and the field's selection may not survive that
      const caret = window.getSelection()!.getRangeAt(0);
      const anchorNode = caret.startContainer;
      const anchorOffset = caret.startOffset;
      options.onLinkRequest(field, (tag) => {
        field.focus();
        const selection = window.getSelection();
        if (!selection) return;
        const range = document.createRange();
        if (anchorNode.isConnected && field.contains(anchorNode) && anchorOffset >= 2) {
          range.setStart(anchorNode, anchorOffset - 2);
          range.setEnd(anchorNode, anchorOffset);
        } else {
          range.selectNodeContents(field);
          range.collapse(false);
        }
        selection.removeAllRanges();
        selection.addRange(range);
        document.execCommand("insertText", false, `[[${tag}]]`);
      });
    }
  });

  container.addEventListener("keydown", (event) => {
    const inText = (event.target as HTMLElement).closest<HTMLElement>(TEXT_SELECTOR);
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z" && !inText) {
      if (undoDelete()) event.preventDefault();
    }
    // Escape leaves the text field for the block's own row, so `/` (insert) and the other keys work again
    if (event.key === "Escape" && inText) {
      event.preventDefault();
      inText.closest<HTMLElement>("[data-node]")?.querySelector<HTMLElement>('[data-action="toggle"]')?.focus();
    }
  });

  // ---------- drag to reorder among siblings ----------

  /** Walks up from `target` to the block that shares a sibling list with the dragged node. */
  function siblingBlockAt(target: HTMLElement): { block: HTMLElement; hit: NodeLocation } | null {
    const dragged = draggedId && locate(draggedId);
    if (!dragged) return null;
    let block = target.closest<HTMLElement>("[data-node]");
    while (block && container.contains(block)) {
      const hit = locate(block.dataset.node!);
      if (hit && hit.siblings === dragged.siblings && hit.node.id !== draggedId) return { block, hit };
      block = block.parentElement?.closest<HTMLElement>("[data-node]") ?? null;
    }
    return null;
  }
  const clearDropMarkers = () => container.querySelectorAll(".dropping").forEach((el) => el.classList.remove("dropping"));

  container.addEventListener("dragstart", (event) => {
    const grip = (event.target as HTMLElement).closest<HTMLElement>(".grip");
    const block = grip?.closest<HTMLElement>("[data-node]");
    if (!grip || !block) return;
    draggedId = block.dataset.node!;
    block.classList.add("dragging");
    event.dataTransfer!.effectAllowed = "move";
    event.dataTransfer!.setData("text/plain", draggedId);
  });
  container.addEventListener("dragover", (event) => {
    const over = siblingBlockAt(event.target as HTMLElement);
    clearDropMarkers();
    if (!over) return;
    event.preventDefault();
    over.block.classList.add("dropping");
  });
  container.addEventListener("dragleave", (event) => {
    if (!container.contains(event.relatedTarget as Node | null)) clearDropMarkers();
  });
  container.addEventListener("drop", (event) => {
    const over = siblingBlockAt(event.target as HTMLElement);
    const dragged = draggedId && locate(draggedId);
    clearDropMarkers();
    draggedId = null;
    if (!over || !dragged) return;
    event.preventDefault();
    const [node] = dragged.siblings.splice(dragged.index, 1);
    const targetIndex = dragged.siblings.indexOf(over.hit.node);
    dragged.siblings.splice(targetIndex, 0, node);
    structureChanged(node.id, "toggle");
  });
  container.addEventListener("dragend", () => {
    draggedId = null;
    clearDropMarkers();
    container.querySelectorAll(".dragging").forEach((el) => el.classList.remove("dragging"));
  });

  return { element: container, render, insert, focusText, undoDelete };
}

/** Icon used by callers that want the same chevron as the block twist (kept here so the two match). */
export const twistIcon = () => svgIcon("chevronDown");
