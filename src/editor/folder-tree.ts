import { iconButton, svgIcon } from "../shared/icons.ts";
import { pathSegments, type Folder } from "../storage/prompt-store.ts";
import { newFolderButton, searchInput, treeElement } from "./elements.ts";
import { createFolder, deleteFolder, renameFolder } from "./folder-actions.ts";
import { childFolders, countPromptsBelow, isFolderEmpty, promptsIn } from "./library.ts";
import { createPromptIn, deletePrompt, renamePrompt, selectPrompt } from "./prompt-actions.ts";
import { editorState } from "./state.ts";
import { hideTooltip } from "./tooltip.ts";

/**
 * The recursive folder tree in the rail. Rows are focusable `div[role=button]`s (not <button>s) so a
 * rename input and action buttons can legally live inside them; Enter / Space activate them.
 * Indentation is 13px for the first three levels and 6px beyond, so deep nesting keeps its room.
 */

const DEEP_LEVEL = 3;

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, ...children: (Node | string)[]): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.append(...children);
  return node;
}

function row(className: string, ...children: (Node | string)[]): HTMLDivElement {
  const div = element("div", "row" + (className ? " " + className : ""), ...children);
  div.setAttribute("role", "button");
  div.tabIndex = 0;
  return div;
}

function renamer(value: string, label: string): HTMLInputElement {
  const input = document.createElement("input");
  input.className = "renamer";
  input.dataset.renamer = "";
  input.value = value;
  input.spellcheck = false;
  input.autocomplete = "off";
  input.setAttribute("aria-label", label);
  return input;
}

function actionButton(icon: Parameters<typeof iconButton>[0], label: string, action: string): HTMLButtonElement {
  const button = iconButton(icon, label, "");
  button.dataset.act = action;
  return button;
}

function matches(name: string, query: string): boolean {
  return name.toLocaleLowerCase().includes(query);
}

function renderFolder(folder: Folder, depth: number, query: string): Node[] {
  const subfolders = childFolders(folder.path).flatMap((child) => renderFolder(child, depth + 1, query));
  const prompts = promptsIn(folder.path).filter((prompt) => !query || matches(prompt.name, query));
  if (query && !subfolders.length && !prompts.length) return [];

  const open = editorState.expandedFolders.has(folder.path) || !!query;
  const renaming = editorState.renamingFolder === folder.path;
  const head = row(open ? "" : "shut", svgIcon("chevronRight", "cv"), svgIcon("folder"));
  head.dataset.folder = folder.path;
  head.setAttribute("aria-expanded", String(open));
  head.appendChild(renaming ? renamer(folder.name, "Folder name") : element("span", "nm", folder.name));
  head.appendChild(element("span", "ct", String(countPromptsBelow(folder.path))));
  const tools = element("span", "ftools",
    actionButton("folderPlus", "New subfolder", "subfolder"),
    actionButton("pencil", "Rename folder", "rename-folder"));
  if (isFolderEmpty(folder.path)) tools.appendChild(actionButton("trash", "Delete empty folder", "delete-folder"));
  head.appendChild(tools);
  if (!open) return [head];

  const current = editorState.currentPrompt;
  const body: Node[] = prompts.map((prompt) => {
    const isOpen = !!current && current.folder === folder.path && current.name === prompt.name;
    const isRenaming = editorState.renamingPrompt?.folder === folder.path && editorState.renamingPrompt.name === prompt.name;
    const item = row(isOpen ? "on" : "", svgIcon("file"));
    item.dataset.prompt = prompt.name;
    item.dataset.folder = folder.path;
    if (isOpen) item.setAttribute("aria-current", "true");
    item.appendChild(isRenaming ? renamer(prompt.name, "Prompt name") : element("span", "nm", prompt.name));
    item.appendChild(element("span", "ftools",
      actionButton("pencil", "Rename prompt", "rename-prompt"),
      actionButton("trash", "Delete prompt", "delete-prompt")));
    return item;
  });
  body.push(...subfolders);
  if (!body.length && !query) body.push(element("p", "empty", "Empty"));
  if (!query) {
    const add = row("", svgIcon("plus"), element("span", "nm", "New prompt"));
    add.dataset.new = folder.path;
    body.push(add);
  }
  return [head, element("div", "sub" + (depth >= DEEP_LEVEL ? " tight" : ""), ...body)];
}

/** Redraws the whole tree from state. Any tooltip is cleared first so it cannot outlive its row. */
export function renderTree(): void {
  hideTooltip();
  const query = editorState.searchQuery.trim().toLocaleLowerCase();
  const rows = childFolders(null).flatMap((folder) => renderFolder(folder, 0, query));
  treeElement.replaceChildren(...(rows.length ? rows : [element("p", "empty", query ? "Nothing matches" : "No folders yet")]));
  const field = treeElement.querySelector<HTMLInputElement>("[data-renamer]");
  if (field) {
    field.focus();
    field.select();
  }
}

// ---------- inline rename ----------

let renameInFlight = false;

/** Commits the open rename field (Enter, click elsewhere). On error the field stays, marked invalid. */
async function commitRename(): Promise<void> {
  const field = treeElement.querySelector<HTMLInputElement>("[data-renamer]");
  const folderPath = editorState.renamingFolder;
  const prompt = editorState.renamingPrompt;
  if (!field || renameInFlight || (!folderPath && !prompt)) return;
  const newName = field.value.trim();
  const oldName = folderPath ? pathSegments(folderPath).pop()! : prompt!.name;
  if (!newName || newName === oldName) return cancelRename();

  renameInFlight = true;
  const error = folderPath ? await renameFolder(folderPath, newName) : await renamePrompt(prompt!.folder, prompt!.name, newName);
  renameInFlight = false;
  if (error) {
    field.classList.add("invalid");
    field.title = error;
    field.setAttribute("aria-invalid", "true");
    field.focus();
    return;
  }
  editorState.renamingFolder = null;
  editorState.renamingPrompt = null;
  renderTree();
}

function cancelRename(): void {
  if (!editorState.renamingFolder && !editorState.renamingPrompt) return;
  editorState.renamingFolder = null;
  editorState.renamingPrompt = null;
  renderTree();
}

function startRename(target: { folder: string } | { folder: string; name: string }): void {
  editorState.renamingFolder = "name" in target ? null : target.folder;
  editorState.renamingPrompt = "name" in target ? target : null;
  renderTree();
}

// ---------- keyboard navigation ----------

function focusableRows(): HTMLElement[] {
  return [...treeElement.querySelectorAll<HTMLElement>(".row")];
}

function moveFocus(from: HTMLElement, delta: 1 | -1): void {
  const rows = focusableRows();
  const next = rows[rows.indexOf(from) + delta];
  next?.focus();
}

function handleRowKey(event: KeyboardEvent, current: HTMLElement): void {
  const folder = current.dataset.folder;
  const isFolderRow = !!folder && !current.dataset.prompt;
  switch (event.key) {
    case "Enter":
    case " ":
      event.preventDefault();
      current.click();
      break;
    case "ArrowDown":
      event.preventDefault();
      moveFocus(current, 1);
      break;
    case "ArrowUp":
      event.preventDefault();
      moveFocus(current, -1);
      break;
    case "ArrowRight":
      event.preventDefault();
      if (isFolderRow && !editorState.expandedFolders.has(folder!)) toggleFolder(folder!, current);
      else moveFocus(current, 1);
      break;
    case "ArrowLeft": {
      event.preventDefault();
      if (isFolderRow && editorState.expandedFolders.has(folder!)) return toggleFolder(folder!, current);
      const parentPath = folder && folder.includes("/") && isFolderRow ? folder.slice(0, folder.lastIndexOf("/")) : isFolderRow ? null : folder;
      if (parentPath) treeElement.querySelector<HTMLElement>(`.row[data-folder="${CSS.escape(parentPath)}"]:not([data-prompt])`)?.focus();
      break;
    }
  }
}

function toggleFolder(path: string, rowElement?: HTMLElement): void {
  if (editorState.expandedFolders.has(path)) editorState.expandedFolders.delete(path);
  else editorState.expandedFolders.add(path);
  renderTree();
  if (rowElement) treeElement.querySelector<HTMLElement>(`.row[data-folder="${CSS.escape(path)}"]:not([data-prompt])`)?.focus();
}

// ---------- events ----------

export function bindFolderTree(): void {
  treeElement.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    if (target.closest("[data-renamer]")) return;
    const rowElement = target.closest<HTMLElement>(".row");
    if (!rowElement) return;
    const { folder, prompt } = rowElement.dataset;
    const action = target.closest<HTMLElement>("[data-act]")?.dataset.act;

    if (action) {
      event.preventDefault();
      if (editorState.renamingFolder || editorState.renamingPrompt) cancelRename();
      if (action === "subfolder") return void createFolder(folder!);
      if (action === "rename-folder") return startRename({ folder: folder! });
      if (action === "delete-folder") return void deleteFolder(folder!);
      if (action === "rename-prompt") return startRename({ folder: folder!, name: prompt! });
      if (action === "delete-prompt") return void deletePrompt(folder!, prompt!);
      return;
    }
    if (editorState.renamingFolder || editorState.renamingPrompt) {
      void commitRename();
      return;
    }
    if (rowElement.dataset.new) return void createPromptIn(rowElement.dataset.new);
    if (prompt) return void selectPrompt(folder!, prompt);
    if (folder) toggleFolder(folder);
  });

  treeElement.addEventListener("keydown", (event) => {
    const target = event.target as HTMLElement;
    if (target.matches("[data-renamer]")) {
      if (event.key === "Enter") { event.preventDefault(); void commitRename(); }
      else if (event.key === "Escape") { event.preventDefault(); cancelRename(); }
      return;
    }
    const rowElement = target.closest<HTMLElement>(".row");
    if (rowElement && rowElement === target) handleRowKey(event, rowElement);
  });

  // clicking away commits; the field is removed by the re-render, so ignore focusout caused by that
  treeElement.addEventListener("focusout", (event) => {
    const field = event.target as HTMLElement;
    if (field.matches("[data-renamer]") && field.isConnected && !renameInFlight) {
      setTimeout(() => { if (field.isConnected) void commitRename(); }, 0);
    }
  });

  searchInput.addEventListener("input", () => {
    editorState.searchQuery = searchInput.value;
    cancelRename();
    renderTree();
  });
  searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && searchInput.value) {
      searchInput.value = "";
      editorState.searchQuery = "";
      renderTree();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      focusableRows()[0]?.focus();
    }
  });
  newFolderButton.addEventListener("click", () => { cancelRename(); void createFolder(null); });
}
