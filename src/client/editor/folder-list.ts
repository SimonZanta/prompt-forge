import type { Folder } from "../../prompts/index.ts";
import { apiRequest, jsonRequestOptions } from "../shared/api.ts";
import { folderApiPath } from "./api-paths.ts";
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

/** Reloads the folder list from the server. */
export async function refreshFolders(): Promise<void> {
  editorState.folders = await apiRequest<Folder[]>("/folders");
  renderFolderList();
}

async function createFolder(): Promise<void> {
  const enteredName = await askForName("Untitled", { title: "New folder", confirmLabel: "Create" });
  if (enteredName === null || !enteredName.trim()) return;
  let created: Folder;
  try {
    created = await apiRequest<Folder>("/folders", jsonRequestOptions("POST", { name: enteredName.trim() }));
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
  let renamed: { name: string };
  try {
    renamed = await apiRequest<{ name: string }>(folderApiPath(folder.name), jsonRequestOptions("PUT", { name: newName }));
  } catch (error) {
    alert(error instanceof Error ? error.message : String(error));
    return;
  }
  if (editorState.currentFolder === folder.name) {
    editorState.currentFolder = renamed.name;
    folderNameLabel.textContent = renamed.name;
  }
  if (editorState.currentPrompt && editorState.currentPrompt.folder === folder.name) {
    editorState.currentPrompt.folder = renamed.name;
  }
  await refreshFolders();
}

async function deleteFolderByName(name: string): Promise<void> {
  await apiRequest(folderApiPath(name), { method: "DELETE" });
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

export function bindFolderNavigation(): void {
  newFolderButton.onclick = createFolder;
  backToFoldersButton.onclick = () => {
    sidebarElement.classList.remove("in-folder");
    refreshFolders();
  };
}
