import { iconButton, svgIcon } from "../shared/icons.ts";
import { isValidTagName } from "../storage/tag-validation.ts";
import { clearLinkHighlights, updateFieldLinkHighlights, updateLinkHighlights } from "./link-highlight.ts";
import { countWords, findNode, renameTagEverywhere, type NodeLocation, type PromptNode } from "./node-tree.ts";
import { notify } from "./notices.ts";
import { tagColorClass } from "./syntax-highlight.ts";

/**
 * The block composer: renders a list of nodes as nested blocks and edits them in place. Any number of
 * editors can be live at once (the prompt canvas, one per custom block definition in settings), each
 * owning one sibling list.
 *
 * Text edits go straight into the node without re-rendering, so the caret never jumps; only
 * structural changes (toggle, insert, delete, reorder, rename) rebuild the DOM.
 *
 * Keyboard model: every block row is focusable. Escape in a text field selects its block; on a
 * block, Up / Down step through the visible blocks in document order (an expanded block's children
 * included, a collapsed block's skipped), Enter expands a collapsed block or edits its text, `/`
 * inserts a child, Delete removes the block with everything below it (Ctrl+Z or the toast's Undo
 * bring it back), F2 renames the tag, Left / Right collapse / expand or step to parent / first child.
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
const BLOCK_SELECTOR = "[data-node]";

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, ...children: (Node | string)[]): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.append(...children);
  return node;
}

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
  /** Node whose chip is currently an inline rename field. */
  let renamingId: string | null = null;

  const locate = (nodeId: string): NodeLocation | null => findNode(nodeId, options.getNodes());

  function renderChip(node: PromptNode, depth: number): HTMLElement {
    if (renamingId === node.id) {
      const field = document.createElement("input");
      field.className = "tag tagedit " + tagColorClass(node.tag);
      field.value = node.tag;
      field.spellcheck = false;
      field.autocomplete = "off";
      field.dataset.tagedit = "";
      field.setAttribute("aria-label", "Tag name");
      // border-box: the padding and border come on top of the characters
      field.style.width = `calc(${node.tag.length + 1}ch + 12px)`;
      return field;
    }
    // same colour per tag name as the XML view, so a tag is recognisable in both
    const chip = element("span", "tag " + tagColorClass(node.tag) + (depth === 0 && accentRoots ? " root" : ""), node.tag);
    chip.dataset.action = "rename";
    chip.title = "Rename tag (F2) — every block and [[link]] with this name follows";
    return chip;
  }

  function renderNode(node: PromptNode, depth: number): HTMLElement {
    const hasChildren = node.children.length > 0;
    const isLeaf = !hasChildren && !node.text;

    const twist = iconButton("chevronDown", node.open ? "Collapse block" : "Expand block", "twist" + (isLeaf ? " leaf" : ""));
    twist.dataset.action = "toggle";
    twist.tabIndex = -1;
    twist.setAttribute("aria-expanded", String(node.open));

    let summary: HTMLElement;
    if (!node.open) {
      summary = element("span", "peek", node.text || (hasChildren ? node.children.length + " nested" : "empty"));
    } else {
      summary = element("span", "meta", hasChildren ? String(node.children.length) : node.text ? countWords(node.text) + " w" : "");
    }

    const grip = iconButton("grip", "Drag to reorder", "iconbtn grip");
    grip.draggable = true;
    grip.tabIndex = -1;
    const add = iconButton("plus", "Add child block (/)");
    add.dataset.action = "add";
    add.tabIndex = -1;
    const remove = iconButton("trash", "Delete block (Delete)");
    remove.dataset.action = "delete";
    remove.tabIndex = -1;
    const tools = element("div", "tools", grip, add, remove);

    const head = element("div", "bhead", twist, renderChip(node, depth), summary, tools);
    const block = element("div", "block" + (depth ? " nested" : ""), head);
    block.dataset.node = node.id;
    block.tabIndex = 0;
    block.setAttribute("role", "treeitem");
    block.setAttribute("aria-label", node.tag);
    if (hasChildren) block.setAttribute("aria-expanded", String(node.open));

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
        const kids = element("div", "kids", ...node.children.map((child) => renderNode(child, depth + 1)));
        kids.setAttribute("role", "group");
        block.appendChild(kids);
      }
    }
    return block;
  }

  function render(): void {
    clearLinkHighlights(container);
    container.setAttribute("role", "tree");
    container.replaceChildren(...options.getNodes().map((node) => renderNode(node, 0)));
    const addRow = element("button", "addrow", element("span", "key", "/"), " type to insert a block");
    addRow.type = "button";
    addRow.dataset.action = "add-root";
    container.appendChild(addRow);
    updateLinkHighlights(container);
    const renamer = container.querySelector<HTMLInputElement>("[data-tagedit]");
    if (renamer) {
      renamer.focus();
      renamer.select();
    }
  }

  /** Focuses the block's own text field (not a child's); false when the block has none. */
  function focusText(nodeId: string): boolean {
    const field = blockElementOf(container, nodeId)?.querySelector<HTMLElement>(`:scope > ${TEXT_SELECTOR}`);
    if (!field) return false;
    field.focus();
    return true;
  }

  function focusBlock(nodeId: string): boolean {
    const block = blockElementOf(container, nodeId);
    if (!block) return false;
    block.focus();
    return true;
  }

  /** Re-renders after a structural change and puts focus on `focusNodeId` — its text field or its row. */
  function structureChanged(focusNodeId?: string, focusPart: "text" | "block" = "text"): void {
    render();
    if (focusNodeId && !renamingId) {
      if (focusPart === "block" || !focusText(focusNodeId)) focusBlock(focusNodeId);
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
    const inserted = blockElementOf(container, nodes[0].id);
    if (inserted && document.activeElement === inserted) {
      inserted.querySelector<HTMLElement>(TEXT_SELECTOR)?.focus();
    }
  }

  /** Removes `hit.node` with everything below it; the neighbour (or parent) row takes focus. */
  function deleteNode(hit: NodeLocation): void {
    hit.siblings.splice(hit.index, 1);
    lastDeleted = { parentId: hit.parent?.id ?? null, index: hit.index, node: hit.node };
    const neighbour = hit.siblings[Math.min(hit.index, hit.siblings.length - 1)];
    structureChanged(neighbour?.id ?? hit.parent?.id, "block");
    const below = hit.node.children.length;
    notify(`Deleted ${hit.node.tag}` + (below ? ` and ${below} nested block${below > 1 ? "s" : ""}` : ""), {
      action: { label: "Undo", run: () => { undoDelete(); } },
    });
  }

  function undoDelete(): boolean {
    if (!lastDeleted) return false;
    const { parentId, index, node } = lastDeleted;
    const siblings = parentId ? locate(parentId)?.node.children : options.getNodes();
    if (!siblings) return false;
    siblings.splice(Math.min(index, siblings.length), 0, node);
    lastDeleted = null;
    structureChanged(node.id, "block");
    return true;
  }

  function toggle(hit: NodeLocation): void {
    hit.node.open = !hit.node.open;
    structureChanged(hit.node.id, "block");
  }

  // ---------- tag rename (chip → inline field; every block and link with that name follows) ----------

  function startRename(nodeId: string): void {
    renamingId = nodeId;
    render();
  }

  function finishRename(commit: boolean): void {
    const nodeId = renamingId;
    if (!nodeId) return;
    const field = container.querySelector<HTMLInputElement>("[data-tagedit]");
    const hit = locate(nodeId);
    const newName = field?.value.trim() ?? "";
    renamingId = null;
    if (!commit || !hit || !field || !newName || newName === hit.node.tag) {
      render();
      focusBlock(nodeId);
      return;
    }
    if (!isValidTagName(newName)) {
      renamingId = nodeId;
      field.classList.add("invalid");
      field.setAttribute("aria-invalid", "true");
      field.title = "A tag starts with a letter or _ and contains letters, digits, _ . : -";
      field.focus();
      return;
    }
    const changed = renameTagEverywhere(options.getNodes(), hit.node.tag, newName);
    structureChanged(nodeId, "block");
    if (changed > 1) notify(`Renamed ${changed} occurrences to ${newName}`);
  }

  // ---------- keyboard navigation over the visible blocks ----------

  function visibleBlocks(): HTMLElement[] {
    return [...container.querySelectorAll<HTMLElement>(BLOCK_SELECTOR)];
  }

  function stepFocus(from: HTMLElement, delta: 1 | -1): void {
    const blocks = visibleBlocks();
    blocks[blocks.indexOf(from) + delta]?.focus();
  }

  function parentBlockOf(block: HTMLElement): HTMLElement | null {
    const parent = block.parentElement?.closest<HTMLElement>(BLOCK_SELECTOR) ?? null;
    return parent && container.contains(parent) ? parent : null;
  }

  function handleBlockKey(event: KeyboardEvent, block: HTMLElement): void {
    const hit = locate(block.dataset.node!);
    if (!hit) return;
    const { node } = hit;
    const expandable = node.children.length > 0 || !!node.text;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        stepFocus(block, 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        stepFocus(block, -1);
        break;
      case "Enter":
        event.preventDefault();
        if (!node.open && expandable) return toggle(hit);
        if (focusText(node.id)) return;
        // an open container without its own text: step into its first child
        block.querySelector<HTMLElement>(`:scope > .kids > ${BLOCK_SELECTOR}`)?.focus();
        break;
      case "ArrowRight":
        event.preventDefault();
        if (!node.open && expandable) return toggle(hit);
        block.querySelector<HTMLElement>(`:scope > .kids > ${BLOCK_SELECTOR}`)?.focus();
        break;
      case "ArrowLeft":
        event.preventDefault();
        if (node.open && node.children.length) return toggle(hit);
        parentBlockOf(block)?.focus();
        break;
      case "Escape":
        event.preventDefault();
        parentBlockOf(block)?.focus();
        break;
      case "/":
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        event.preventDefault();
        options.onInsert(block.querySelector<HTMLElement>(":scope > .bhead") ?? block, node.id);
        break;
      case "Delete":
      case "Backspace":
        event.preventDefault();
        deleteNode(hit);
        break;
      case "F2":
        event.preventDefault();
        startRename(node.id);
        break;
    }
  }

  // ---------- events (delegated on the container) ----------

  container.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    if (target.closest("[data-tagedit]")) return;
    const actionElement = target.closest<HTMLElement>("[data-action]");
    if (!actionElement || !container.contains(actionElement)) return;
    const action = actionElement.dataset.action;
    if (action === "add-root") return options.onInsert(actionElement, null);
    const block = actionElement.closest<HTMLElement>(BLOCK_SELECTOR);
    const hit = block && locate(block.dataset.node!);
    if (!hit) return;
    if (action === "toggle") toggle(hit);
    else if (action === "add") options.onInsert(actionElement, hit.node.id);
    else if (action === "delete") deleteNode(hit);
    else if (action === "rename") startRename(hit.node.id);
  });

  container.addEventListener("input", (event) => {
    const field = (event.target as HTMLElement).closest<HTMLElement>(TEXT_SELECTOR);
    if (!field) return;
    const block = field.closest<HTMLElement>(BLOCK_SELECTOR);
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
    const target = event.target as HTMLElement;
    if (target.matches("[data-tagedit]")) {
      if (event.key === "Enter") { event.preventDefault(); finishRename(true); }
      else if (event.key === "Escape") { event.preventDefault(); finishRename(false); }
      return;
    }
    const inText = target.closest<HTMLElement>(TEXT_SELECTOR);
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z" && !inText) {
      if (undoDelete()) event.preventDefault();
      return;
    }
    // Escape leaves the text field for the block's own row, where the navigation keys work
    if (event.key === "Escape" && inText) {
      event.preventDefault();
      inText.closest<HTMLElement>(BLOCK_SELECTOR)?.focus();
      return;
    }
    if (!inText && target.matches(BLOCK_SELECTOR)) handleBlockKey(event, target);
  });

  // clicking away from the rename field commits it (the re-render removes the field, so ignore that focusout)
  container.addEventListener("focusout", (event) => {
    const field = event.target as HTMLElement;
    if (field.matches("[data-tagedit]") && field.isConnected) {
      setTimeout(() => { if (field.isConnected && renamingId) finishRename(true); }, 0);
    }
  });

  // ---------- drag to reorder among siblings ----------

  /** Walks up from `target` to the block that shares a sibling list with the dragged node. */
  function siblingBlockAt(target: HTMLElement): { block: HTMLElement; hit: NodeLocation } | null {
    const dragged = draggedId && locate(draggedId);
    if (!dragged) return null;
    let block = target.closest<HTMLElement>(BLOCK_SELECTOR);
    while (block && container.contains(block)) {
      const hit = locate(block.dataset.node!);
      if (hit && hit.siblings === dragged.siblings && hit.node.id !== draggedId) return { block, hit };
      block = block.parentElement?.closest<HTMLElement>(BLOCK_SELECTOR) ?? null;
    }
    return null;
  }
  const clearDropMarkers = () => container.querySelectorAll(".dropping").forEach((el) => el.classList.remove("dropping"));

  container.addEventListener("dragstart", (event) => {
    const grip = (event.target as HTMLElement).closest<HTMLElement>(".grip");
    const block = grip?.closest<HTMLElement>(BLOCK_SELECTOR);
    if (!grip || !block) return;
    draggedId = block.dataset.node!;
    event.dataTransfer!.effectAllowed = "move";
    event.dataTransfer!.setData("text/plain", draggedId);
    // The ghost under the pointer is a highlighted copy of the whole block. The browser snapshots the
    // element passed to setDragImage as it is rendered right now, so the copy is styled first and
    // parked off-screen, then discarded once the snapshot has been taken.
    const rect = block.getBoundingClientRect();
    const ghost = block.cloneNode(true) as HTMLElement;
    ghost.classList.add("drag-ghost");
    ghost.style.width = rect.width + "px";
    document.body.appendChild(ghost);
    event.dataTransfer!.setDragImage(ghost, event.clientX - rect.left, event.clientY - rect.top);
    setTimeout(() => ghost.remove(), 0);
    block.classList.add("dragging");
    container.classList.add("drag-active");
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
    endDrag();
    if (!over || !dragged) return;
    event.preventDefault();
    const [node] = dragged.siblings.splice(dragged.index, 1);
    const targetIndex = dragged.siblings.indexOf(over.hit.node);
    dragged.siblings.splice(targetIndex, 0, node);
    structureChanged(node.id, "block");
  });
  const endDrag = () => {
    draggedId = null;
    clearDropMarkers();
    container.classList.remove("drag-active");
    container.querySelectorAll(".dragging").forEach((el) => el.classList.remove("dragging"));
  };
  container.addEventListener("dragend", endDrag);

  return { element: container, render, insert, focusText, undoDelete };
}

/** Icon used by callers that want the same chevron as the block twist (kept here so the two match). */
export const twistIcon = () => svgIcon("chevronDown");
