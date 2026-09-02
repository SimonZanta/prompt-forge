import type { Prompt } from "../../prompts/index.ts";
import { apiRequest, jsonRequestOptions } from "../shared/api.ts";
import { promptApiPath } from "./api-paths.ts";
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

/** Writes the content of the current prompt to its file on the server. */
export async function saveCurrentPrompt(): Promise<void> {
  pendingSaveTimer = null;
  const prompt = editorState.currentPrompt;
  if (!prompt) return;
  prompt.content = editorTextarea.value;
  await apiRequest(promptApiPath(prompt.folder, prompt.name), jsonRequestOptions("PUT", { content: prompt.content }));
  setSaveStatus("");
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
    const renamed = await apiRequest<Prompt>(promptApiPath(prompt.folder, prompt.name), jsonRequestOptions("PUT", { name }));
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
