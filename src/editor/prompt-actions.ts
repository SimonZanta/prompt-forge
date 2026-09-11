import { promptStore } from "../storage/active-prompt-store.ts";
import { NEW_PROMPT_CONTENT } from "../storage/prompt-defaults.ts";
import { isWithin, type Prompt } from "../storage/prompt-store.ts";
import { cancelPendingSave, flushPendingSave, setSaveStatus } from "./autosave.ts";
import { editorTextarea, folderChip, titleInput } from "./elements.ts";
import { renderTree } from "./folder-tree.ts";
import { refreshHighlight } from "./highlight-layer.ts";
import { legacyRewriteNeeded, migrateLegacyXml } from "./legacy-xml.ts";
import { childFolders, expandPathTo, promptsIn, refreshLibrary, uniqueName } from "./library.ts";
import { confirmDialog, notify, notifyError } from "./notices.ts";
import { parsePromptXml, type PromptTree } from "./node-tree.ts";
import { editorState } from "./state.ts";
import { closeSuggestions } from "./suggestions.ts";
import { applyView } from "./view-toggle.ts";

/** Opening, creating, renaming and deleting prompts; keeps the header (title, folder chip) in step. */

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Title and folder chip for the open prompt (or nothing). */
export function updateHeader(): void {
  const prompt = editorState.currentPrompt;
  titleInput.value = prompt?.name ?? "";
  folderChip.textContent = prompt ? prompt.folder.split("/").join(" / ") : "";
}

/** Empties the editor when the open prompt (or its folder) was deleted. */
export function clearEditor(): void {
  editorState.currentPrompt = null;
  editorTextarea.value = "";
  editorState.previousValue = "";
  cancelPendingSave();
  setSaveStatus("");
  refreshHighlight();
  updateHeader();
  applyView();
}

/**
 * Parses a file into its block tree. A file from the old free-text editor that fails to parse is
 * repaired once (backtick tag references become `[[tag]]` links, code is escaped) and written back;
 * one that still fails opens in the XML view only.
 */
async function loadTree(folder: string, name: string, content: string): Promise<{ content: string; tree: PromptTree | null }> {
  const tree = parsePromptXml(content);
  if (tree) return { content, tree };
  if (!legacyRewriteNeeded(content)) return { content, tree: null };
  const migrated = migrateLegacyXml(content);
  const migratedTree = parsePromptXml(migrated);
  if (!migratedTree) return { content, tree: null };
  await promptStore().writePrompt(folder, name, migrated);
  return { content: migrated, tree: migratedTree };
}

/** Opens a prompt (after saving the previous one) and shows it in the rail. */
export async function selectPrompt(folder: string, name: string): Promise<void> {
  await flushPendingSave();
  let prompt: Prompt;
  try {
    prompt = await promptStore().readPrompt(folder, name);
  } catch {
    return;
  }
  const { content, tree } = await loadTree(folder, prompt.name, prompt.content || "");
  editorState.currentPrompt = { folder, name: prompt.name, content, tree, xmlValid: tree !== null };
  editorTextarea.value = content;
  editorState.previousValue = content;
  refreshHighlight();
  setSaveStatus("");
  closeSuggestions();
  updateHeader();
  expandPathTo(folder);
  renderTree();
  editorState.page = "editor";
  applyView();
}

/** On startup or after a storage switch: opens the first prompt found, expanding the way to it. */
export async function openInitialPrompt(): Promise<void> {
  if (editorState.currentPrompt) return;
  const withPrompts = [...editorState.folders].sort((a, b) => a.path.localeCompare(b.path)).find((folder) => promptsIn(folder.path).length);
  if (withPrompts) return selectPrompt(withPrompts.path, promptsIn(withPrompts.path)[0].name);
  const first = childFolders(null)[0];
  if (first) editorState.expandedFolders.add(first.path);
  renderTree();
}

/** Creates "Untitled" (or the next free variant) in `folder`, opens it and puts the caret in the title for renaming. */
export async function createPromptIn(folder: string): Promise<void> {
  await flushPendingSave();
  const name = uniqueName("Untitled", promptsIn(folder).map((prompt) => prompt.name));
  try {
    await promptStore().createPrompt(folder, name, NEW_PROMPT_CONTENT);
  } catch (error) {
    notifyError(error);
    return;
  }
  await refreshLibrary();
  await selectPrompt(folder, name);
  titleInput.focus();
  titleInput.select();
}

/** Deletes a prompt after confirmation; if it was open, its folder's first remaining prompt is opened. */
export async function deletePrompt(folder: string, name: string): Promise<void> {
  if (!(await confirmDialog(`Delete "${name}"?`, { confirmLabel: "Delete", danger: true }))) return;
  try {
    await promptStore().deletePrompt(folder, name);
  } catch (error) {
    notifyError(error);
    return;
  }
  const current = editorState.currentPrompt;
  const wasOpen = !!current && current.folder === folder && current.name === name;
  await refreshLibrary();
  if (wasOpen) {
    clearEditor();
    const next = promptsIn(folder)[0];
    if (next) return selectPrompt(folder, next.name);
  }
  renderTree();
}

/** Renames a prompt; resolves with an error message to show inline, or null on success. */
export async function renamePrompt(folder: string, name: string, newName: string): Promise<string | null> {
  if (newName === name) return null;
  await flushPendingSave();
  try {
    await promptStore().renamePrompt(folder, name, newName);
  } catch (error) {
    return errorMessage(error);
  }
  const current = editorState.currentPrompt;
  if (current && current.folder === folder && current.name === name) current.name = newName;
  await refreshLibrary();
  updateHeader();
  renderTree();
  return null;
}

/** Moves a prompt into another folder (rail drag and drop); the open prompt follows if it was the one moved. */
export async function movePrompt(folder: string, name: string, targetFolder: string): Promise<void> {
  if (folder === targetFolder) return;
  await flushPendingSave();
  try {
    await promptStore().movePrompt(folder, name, targetFolder);
  } catch (error) {
    notifyError(error);
    return;
  }
  const current = editorState.currentPrompt;
  if (current && current.folder === folder && current.name === name) {
    current.folder = targetFolder;
    updateHeader();
  }
  await refreshLibrary();
  expandPathTo(targetFolder);
  renderTree();
  notify(`Moved "${name}" to ${targetFolder.split("/").join(" / ")}`);
}

/** After a folder moved from `oldPath` to `newPath`, points the open prompt at its new folder. */
export function relocateOpenPrompt(oldPath: string, newPath: string): void {
  const current = editorState.currentPrompt;
  if (current && isWithin(current.folder, oldPath)) {
    current.folder = newPath + current.folder.slice(oldPath.length);
    updateHeader();
  }
}
