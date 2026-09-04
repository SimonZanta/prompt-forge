import { promptStore } from "../storage/active-prompt-store.ts";
import { saveStatusIndicator, titleInput } from "./elements.ts";
import { renamePrompt } from "./prompt-actions.ts";
import { notify } from "./notices.ts";
import { editorState } from "./state.ts";

const AUTOSAVE_DELAY_MS = 500;

let pendingSaveTimer: ReturnType<typeof setTimeout> | null = null;

/** Shows `●` while a save is pending, empty when everything is saved. */
export function setSaveStatus(text: string): void {
  saveStatusIndicator.textContent = text;
}

/** (Re)starts the autosave countdown; called on every edit in either view. */
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

/**
 * Writes the open prompt's `content` — the XML string — to its file. Both views keep `content`
 * current (the block editor by re-serializing, the XML view by writing the textarea through), so the
 * saver never needs to know which view is active.
 */
export async function saveCurrentPrompt(): Promise<void> {
  pendingSaveTimer = null;
  const prompt = editorState.currentPrompt;
  if (!prompt) return;
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
  const error = await renamePrompt(prompt.folder, prompt.name, name);
  if (error) {
    notify(error, { kind: "error" });
    titleInput.value = prompt.name;
  }
}

export function bindAutosave(): void {
  titleInput.addEventListener("change", renameCurrentPromptFromTitle);
  titleInput.addEventListener("keydown", (event) => { if (event.key === "Enter") titleInput.blur(); });
  window.addEventListener("beforeunload", () => { if (pendingSaveTimer) saveCurrentPrompt(); });
}
