import { promptStore } from "../storage/active-prompt-store.ts";
import { childPath } from "../storage/prompt-store.ts";
import { flushPendingSave } from "./autosave.ts";
import { renderTree } from "./folder-tree.ts";
import { childFolders, isFolderEmpty, refreshLibrary, rekeyExpanded, uniqueName } from "./library.ts";
import { notifyError } from "./notices.ts";
import { relocateOpenPrompt } from "./prompt-actions.ts";
import { editorState } from "./state.ts";

/** Creating, renaming and deleting folders from the rail. */

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Creates "New folder" (or the next free variant) under `parent` and opens its row in rename mode. */
export async function createFolder(parent: string | null): Promise<void> {
  const name = uniqueName("New folder", childFolders(parent).map((folder) => folder.name));
  const path = childPath(parent, name);
  try {
    await promptStore().createFolder(path);
  } catch (error) {
    notifyError(error);
    return;
  }
  await refreshLibrary();
  if (parent) editorState.expandedFolders.add(parent);
  editorState.expandedFolders.add(path);
  editorState.renamingFolder = path;
  renderTree();
}

/** Renames a folder; resolves with an error message to show inline, or null on success. */
export async function renameFolder(path: string, newName: string): Promise<string | null> {
  await flushPendingSave();
  let newPath: string;
  try {
    newPath = (await promptStore().renameFolder(path, newName)).path;
  } catch (error) {
    return errorMessage(error);
  }
  rekeyExpanded(path, newPath);
  relocateOpenPrompt(path, newPath);
  await refreshLibrary();
  renderTree();
  return null;
}

/** Deletes an empty folder (the button only exists when it is). */
export async function deleteFolder(path: string): Promise<void> {
  if (!isFolderEmpty(path)) return;
  try {
    await promptStore().deleteFolder(path);
  } catch (error) {
    notifyError(error);
    return;
  }
  editorState.expandedFolders.delete(path);
  await refreshLibrary();
  renderTree();
}
