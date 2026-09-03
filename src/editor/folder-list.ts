import { promptStore, storageStatus } from "../storage/active-prompt-store.ts";
import type { Folder } from "../storage/prompt-store.ts";
import { flushPendingSave } from "./autosave.ts";
import { backToFoldersButton, folderListElement, folderNameLabel, newFolderButton, sidebarElement } from "./elements.ts";
import { askForName } from "./modal.ts";
import { clearEditor, refreshPromptList, renderPromptList, selectPrompt } from "./prompt-list.ts";
import { editorState } from "./state.ts";

/** Sidebar folders pane: the folder list and creating / renaming / deleting / opening folders.
    Opening a folder slides the prompts pane in (`.sidebar.in-folder`). */

function renderFolderList(): void {
  folderListElement.innerHTML = "";
  for (const folder of editorState.folders) {
    const item = document.createElement("li");

    const name = document.createElement("span");
    name.className = "name";
    name.textContent = folder.name;
    name.title = "Double-click to rename";
    name.ondblclick = (event) => { event.stopPropagation(); renameFolder(folder); };

    const count = document.createElement("span");
    count.className = "count";
    count.textContent = String(folder.prompt_count);

    const deleteButton = document.createElement("button");
    deleteButton.className = "del";
    deleteButton.textContent = "×";
    deleteButton.title = "Delete folder";
    deleteButton.onclick = (event) => {
      event.stopPropagation();
      if (confirm('Delete folder "' + folder.name + '" and all its prompts?')) deleteFolderByName(folder.name);
    };

    item.append(name, count, deleteButton);
    item.onclick = () => openFolder(folder.name);
    folderListElement.appendChild(item);
  }
}

/** Reloads the folder list from the active store (empty while a remembered folder is still locked). */
export async function refreshFolders(): Promise<void> {
  editorState.folders = storageStatus().mode === "folder-locked" ? [] : await promptStore().listFolders();
  renderFolderList();
}

async function createFolder(): Promise<void> {
  const enteredName = await askForName("Untitled", { title: "New folder", confirmLabel: "Create" });
  if (enteredName === null || !enteredName.trim()) return;
  let created: Folder;
  try {
    created = await promptStore().createFolder(enteredName.trim());
  } catch (error) {
    alert(error instanceof Error ? error.message : String(error));
    return;
  }
  await refreshFolders();
  await openFolder(created.name);
}

async function renameFolder(folder: Folder): Promise<void> {
  const enteredName = await askForName(folder.name, { title: "Rename folder", confirmLabel: "Rename" });
  if (enteredName === null) return;
  const newName = enteredName.trim();
  if (!newName || newName === folder.name) return;
  await flushPendingSave();
  try {
    await promptStore().renameFolder(folder.name, newName);
  } catch (error) {
    alert(error instanceof Error ? error.message : String(error));
    return;
  }
  if (editorState.currentFolder === folder.name) {
    editorState.currentFolder = newName;
    folderNameLabel.textContent = newName;
  }
  if (editorState.currentPrompt && editorState.currentPrompt.folder === folder.name) {
    editorState.currentPrompt.folder = newName;
  }
  await refreshFolders();
}

async function deleteFolderByName(name: string): Promise<void> {
  await promptStore().deleteFolder(name);
  if (editorState.currentPrompt && editorState.currentPrompt.folder === name) clearEditor();
  if (editorState.currentFolder === name) {
    editorState.currentFolder = null;
    sidebarElement.classList.remove("in-folder");
  }
  await refreshFolders();
}

/** Shows a folder's prompts in the sidebar and opens its most recent prompt (unless one of its prompts is already open). */
export async function openFolder(name: string): Promise<void> {
  await flushPendingSave();
  editorState.currentFolder = name;
  folderNameLabel.textContent = name;
  await refreshPromptList();
  sidebarElement.classList.add("in-folder");
  const current = editorState.currentPrompt;
  if (current && current.folder === name) renderPromptList();
  else if (editorState.prompts[0]) await selectPrompt(editorState.prompts[0].name);
}

/** Leaves the open folder / prompt behind (used when the storage backend changes). */
export function resetToFolderView(): void {
  clearEditor();
  editorState.currentFolder = null;
  editorState.prompts = [];
  sidebarElement.classList.remove("in-folder");
}

export function bindFolderNavigation(): void {
  newFolderButton.onclick = createFolder;
  backToFoldersButton.onclick = () => {
    sidebarElement.classList.remove("in-folder");
    refreshFolders();
  };
}
