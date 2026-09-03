import { promptStore } from "../storage/active-prompt-store.ts";
import { editorTextarea, saveStatusIndicator, titleInput } from "./elements.ts";
import { refreshPromptList } from "./prompt-list.ts";
import { editorState } from "./state.ts";

const AUTOSAVE_DELAY_MS = 500;

let pendingSaveTimer: ReturnType<typeof setTimeout> | null = null;

/** Shows `●` while a save is pending, empty when everything is saved. */
export function setSaveStatus(text: string): void {
  saveStatusIndicator.textContent = text;
}

/** (Re)starts the autosave countdown; called on every edit. */
export function scheduleSave(): void {
  if (!editorState.currentPrompt) return;
  setSaveStatus("●");
  if (pendingSaveTimer) clearTimeout(pendingSaveTimer);
  pendingSaveTimer = setTimeout(saveCurrentPrompt, AUTOSAVE_DELAY_MS);
}

/** Drops a pending save without writing (used when the open prompt is deleted). */
export function cancelPendingSave(): void {
  if (pendingSaveTimer) clearTimeout(pendingSaveTimer);
  pendingSaveTimer = null;
}

/** Saves immediately if a save is pending (used before switching prompts and on Ctrl+S). */
export async function flushPendingSave(): Promise<void> {
  if (pendingSaveTimer) {
    clearTimeout(pendingSaveTimer);
    await saveCurrentPrompt();
  }
}

/** Writes the content of the current prompt to its file in the active store. */
export async function saveCurrentPrompt(): Promise<void> {
  pendingSaveTimer = null;
  const prompt = editorState.currentPrompt;
  if (!prompt) return;
  prompt.content = editorTextarea.value;
  try {
    await promptStore().writePrompt(prompt.folder, prompt.name, prompt.content);
    setSaveStatus("");
  } catch (error) {
    setSaveStatus("!");
    saveStatusIndicator.title = error instanceof Error ? error.message : String(error);
  }
}

/** The topbar title is the file name: renames the file when committed (Enter / blur), not per keystroke. */
async function renameCurrentPromptFromTitle(): Promise<void> {
  const prompt = editorState.currentPrompt;
  if (!prompt) {
    titleInput.value = "";
    return;
  }
  const name = titleInput.value.trim();
  if (!name || name === prompt.name) {
    titleInput.value = prompt.name;
    return;
  }
  try {
    const renamed = await promptStore().renamePrompt(prompt.folder, prompt.name, name);
    prompt.name = renamed.name;
    titleInput.value = renamed.name;
    if (prompt.folder === editorState.currentFolder) await refreshPromptList();
  } catch (error) {
    alert(error instanceof Error ? error.message : String(error));
    titleInput.value = prompt.name;
  }
}

export function bindAutosave(): void {
  titleInput.addEventListener("change", renameCurrentPromptFromTitle);
  window.addEventListener("beforeunload", () => { if (pendingSaveTimer) saveCurrentPrompt(); });
}
