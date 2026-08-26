import { apiRequest, jsonRequestOptions } from "../shared/api.ts";
import { editorTextarea, saveStatusIndicator, titleInput } from "./elements.ts";
import { renderPromptList } from "./prompt-list.ts";
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

/** Saves immediately if a save is pending (used before switching prompts and on Ctrl+S). */
export async function flushPendingSave(): Promise<void> {
  if (pendingSaveTimer) {
    clearTimeout(pendingSaveTimer);
    await saveCurrentPrompt();
  }
}

/** Writes the title and content of the current prompt to the server. */
export async function saveCurrentPrompt(): Promise<void> {
  pendingSaveTimer = null;
  const prompt = editorState.currentPrompt;
  if (!prompt) return;
  prompt.title = titleInput.value.trim() || "Untitled";
  prompt.content = editorTextarea.value;
  await apiRequest("/prompts/" + prompt.id, jsonRequestOptions("PUT", { title: prompt.title, content: prompt.content }));
  setSaveStatus("");
  renderPromptList();
}

export function bindAutosave(): void {
  titleInput.addEventListener("input", scheduleSave);
  window.addEventListener("beforeunload", () => { if (pendingSaveTimer) saveCurrentPrompt(); });
}
