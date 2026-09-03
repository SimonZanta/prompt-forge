import { loadSettings } from "../storage/settings-store.ts";
import { isValidTagName } from "../storage/tag-validation.ts";
import { cloneNodes, createNode, parseFragmentXml, type PromptNode } from "./node-tree.ts";
import { tagColorClass } from "./syntax-highlight.ts";

/**
 * The single insertion gesture: a floating, filterable list of custom blocks and tags. Settings are
 * read live on every open, so an edit to a block definition changes what the menu inserts.
 * The same menu in `link` mode completes `[[tag]]` references inside block text.
 */

interface MenuItem {
  group: string;
  label: string;
  hint: string;
  /** Nodes to insert (insert mode) or the tag to link (link mode); null for an unusable item. */
  pick(): PromptNode[] | string | null;
  /** Set for tag items: coloured like the tag in the editor. */
  tag?: string;
}

export type InsertMenuRequest =
  | { mode: "insert"; anchor: HTMLElement; tagsInUse: Iterable<string>; onPick(nodes: PromptNode[]): void }
  | { mode: "link"; anchor: HTMLElement; tagsInUse: Iterable<string>; onPick(tag: string): void };

const MENU_WIDTH = 250;
const MENU_HEIGHT = 280;

let menu: HTMLDivElement | null = null;
let query: HTMLInputElement;
let list: HTMLDivElement;
let request: InsertMenuRequest | null = null;
let items: MenuItem[] = [];
let selectedIndex = 0;

function ensureMenu(): HTMLDivElement {
  if (menu) return menu;
  menu = document.createElement("div");
  menu.className = "menu";
  menu.hidden = true;
  menu.setAttribute("role", "dialog");
  menu.setAttribute("aria-label", "Insert block");
  query = document.createElement("input");
  query.spellcheck = false;
  query.autocomplete = "off";
  query.setAttribute("aria-label", "Filter blocks and tags");
  list = document.createElement("div");
  list.className = "mlist";
  menu.append(query, list);
  document.body.appendChild(menu);

  query.addEventListener("input", renderItems);
  query.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") { event.preventDefault(); moveSelection(1); }
    else if (event.key === "ArrowUp") { event.preventDefault(); moveSelection(-1); }
    else if (event.key === "Enter") { event.preventDefault(); pick(selectedIndex); }
    else if (event.key === "Escape") { event.preventDefault(); closeInsertMenu(true); }
  });
  list.addEventListener("click", (event) => {
    const item = (event.target as HTMLElement).closest<HTMLElement>(".mitem");
    if (item) pick(Number(item.dataset.index));
  });
  document.addEventListener("pointerdown", (event) => {
    if (!menu!.hidden && !menu!.contains(event.target as Node)) closeInsertMenu(false);
  });
  window.addEventListener("resize", () => closeInsertMenu(false));
  return menu;
}

export function isInsertMenuOpen(): boolean {
  return !!menu && !menu.hidden;
}

function blockItems(filter: string): MenuItem[] {
  return loadSettings().blocks
    .filter((block) => block.command.toLowerCase().includes(filter))
    .map((block) => {
      const nodes = parseFragmentXml(block.content);
      return {
        group: "Custom blocks",
        label: block.command,
        hint: nodes ? describeFragment(nodes) : "invalid XML",
        pick: () => (nodes ? cloneNodes(nodes) : null),
      };
    });
}

/** "task_description + example" — what a block will insert, in one line. */
export function describeFragment(nodes: PromptNode[]): string {
  if (!nodes.length) return "empty";
  if (nodes.length === 1) return nodes[0].children.length ? nodes[0].children.map((child) => child.tag).join(" + ") : nodes[0].tag;
  return nodes.map((node) => node.tag).join(" + ");
}

function tagItems(filter: string, tagsInUse: Iterable<string>, mode: "insert" | "link"): MenuItem[] {
  const names = mode === "link"
    ? new Set([...tagsInUse, ...loadSettings().tags])
    : new Set([...loadSettings().tags, ...tagsInUse]);
  return [...names]
    .filter((name) => name.toLowerCase().includes(filter))
    .map((name) => ({
      group: mode === "link" ? "Link to" : "Tags",
      label: name,
      hint: "",
      tag: name,
      pick: () => (mode === "link" ? name : [createNode(name)]),
    }));
}

function renderItems(): void {
  if (!request) return;
  const filter = query.value.trim().toLowerCase();
  const mode = request.mode;
  items = mode === "insert" ? [...blockItems(filter), ...tagItems(filter, request.tagsInUse, mode)] : tagItems(filter, request.tagsInUse, mode);
  if (filter && !items.some((item) => item.label === filter) && isValidTagName(filter)) {
    items.push({
      group: mode === "insert" ? "Tags" : "Link to",
      label: filter,
      hint: mode === "insert" ? "create tag" : "link",
      tag: filter,
      pick: () => (mode === "link" ? filter : [createNode(filter)]),
    });
  }
  selectedIndex = 0;
  list.replaceChildren();
  let lastGroup = "";
  items.forEach((item, index) => {
    if (item.group !== lastGroup) {
      const heading = document.createElement("p");
      heading.className = "mgroup";
      heading.textContent = item.group;
      list.appendChild(heading);
      lastGroup = item.group;
    }
    const button = document.createElement("button");
    button.type = "button";
    button.className = "mitem" + (index === selectedIndex ? " sel" : "");
    button.dataset.index = String(index);
    const label = document.createElement("span");
    label.className = "mt" + (item.tag ? " " + tagColorClass(item.tag) : "");
    label.textContent = item.label;
    const hint = document.createElement("span");
    hint.className = "md" + (item.hint === "invalid XML" ? " bad" : "");
    hint.textContent = item.hint;
    button.append(label, hint);
    list.appendChild(button);
  });
  if (!items.length) {
    const none = document.createElement("p");
    none.className = "mnone";
    none.textContent = filter ? "Not a valid tag name" : "Type a tag name";
    list.appendChild(none);
  }
}

function moveSelection(direction: 1 | -1): void {
  if (!items.length) return;
  selectedIndex = (selectedIndex + direction + items.length) % items.length;
  const buttons = list.querySelectorAll<HTMLElement>(".mitem");
  buttons.forEach((button, index) => button.classList.toggle("sel", index === selectedIndex));
  buttons[selectedIndex]?.scrollIntoView({ block: "nearest" });
}

function pick(index: number): void {
  const item = items[index];
  const current = request;
  if (!item || !current) return;
  const result = item.pick();
  if (result === null) return;
  closeInsertMenu(false);
  if (current.mode === "insert") current.onPick(result as PromptNode[]);
  else current.onPick(result as string);
}

export function openInsertMenu(nextRequest: InsertMenuRequest): void {
  const element = ensureMenu();
  request = nextRequest;
  const rect = nextRequest.anchor.getBoundingClientRect();
  element.hidden = false;
  element.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - MENU_WIDTH - 12)) + "px";
  element.style.top = Math.min(rect.bottom + 4, window.innerHeight - MENU_HEIGHT) + "px";
  query.value = "";
  query.placeholder = nextRequest.mode === "insert" ? "tag or block name" : "tag to link";
  renderItems();
  query.focus();
}

/** Closes the menu; `restoreFocus` puts focus back on the element that opened it (Escape). */
export function closeInsertMenu(restoreFocus: boolean): void {
  if (!menu || menu.hidden) return;
  menu.hidden = true;
  const anchor = request?.anchor;
  request = null;
  if (restoreFocus && anchor?.isConnected) anchor.focus();
}
