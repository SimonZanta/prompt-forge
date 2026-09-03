import { promptStore } from "../storage/active-prompt-store.ts";
import type { Prompt } from "../storage/prompt-store.ts";
import { setSaveStatus } from "./autosave.ts";
import { editorTextarea } from "./elements.ts";
import { refreshHighlight } from "./highlight-layer.ts";
import { askForName, isNameDialogOpen } from "./modal.ts";
import { refreshPromptList, selectPrompt } from "./prompt-list.ts";
import { editorState } from "./state.ts";

/** A complete `<command>…</command>` element (no name attribute yet, caret outside)
    is saved as a new .xml prompt file in the current folder, then stamped with
    `name="…"` so it is only extracted once. */

const COMMAND_TAG_RE = /<command(\s[^<>]*)?>([\s\S]*?)<\/command>/g;
const COMMAND_CHECK_DELAY_MS = 800;

let commandCheckTimer: ReturnType<typeof setTimeout> | null = null;
let isExtractingCommand = false;
/** Command elements the user declined to save (or that failed), so we do not ask again. */
const skippedCommands = new Set<string>();

/** Strips a surrounding ``` fence, keeping only the code inside. */
function unwrapFence(text: string): string {
  const match = text.trim().match(/^```[^\n]*\n?([\s\S]*?)\n?```$/);
  return (match ? match[1] : text).trim() + "\n";
}

/** (Re)starts the extraction countdown; called on every edit. */
export function scheduleCommandCheck(): void {
  if (commandCheckTimer) clearTimeout(commandCheckTimer);
  commandCheckTimer = setTimeout(checkForCompletedCommands, COMMAND_CHECK_DELAY_MS);
}

async function checkForCompletedCommands(): Promise<void> {
  if (!editorState.currentPrompt || isExtractingCommand || isNameDialogOpen()) return;
  const text = editorTextarea.value;
  COMMAND_TAG_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = COMMAND_TAG_RE.exec(text))) {
    const attributes = match[1] || "";
    if (/\bname\s*=/.test(attributes)) continue;
    if (!match[2].trim()) continue;
    if (skippedCommands.has(match[0])) continue;
    // Leave the element alone while the caret is still inside it.
    const start = match.index, end = match.index + match[0].length;
    if (document.activeElement === editorTextarea && editorTextarea.selectionStart > start && editorTextarea.selectionStart < end) continue;
    await extractCommand(match[0], attributes, match[2]);
    return;
  }
}

async function extractCommand(rawElement: string, attributes: string, innerText: string): Promise<void> {
  if (!editorState.currentPrompt) return;
  isExtractingCommand = true;
  try {
    const folder = editorState.currentPrompt.folder;
    const enteredName = await askForName("Untitled", { title: "Save <command> as prompt", confirmLabel: "Save" });
    if (enteredName === null || !enteredName.trim()) {
      skippedCommands.add(rawElement);
      return;
    }
    let created: Prompt;
    try {
      created = await promptStore().createPrompt(folder, enteredName.trim(), unwrapFence(innerText));
    } catch (error) {
      alert(error instanceof Error ? error.message : String(error));
      skippedCommands.add(rawElement);
      return;
    }
    const elementIndex = editorTextarea.value.indexOf(rawElement);
    if (elementIndex >= 0) {
      const stamped = '<command name="' + created.name.replace(/&/g, "&amp;").replace(/"/g, "&quot;") + '"'
        + attributes + rawElement.slice(("<command" + attributes).length);
      editorTextarea.setRangeText(stamped, elementIndex, elementIndex + rawElement.length, "preserve");
      editorState.previousValue = editorTextarea.value;
      refreshHighlight();
    }
    if (editorState.currentPrompt) {
      editorState.currentPrompt.content = editorTextarea.value;
      await promptStore().writePrompt(
        editorState.currentPrompt.folder,
        editorState.currentPrompt.name,
        editorState.currentPrompt.content,
      );
      setSaveStatus("");
    }
    if (editorState.currentFolder === folder) {
      await refreshPromptList();
      await selectPrompt(created.name);
    }
  } finally {
    isExtractingCommand = false;
  }
}

export function bindCommandExtraction(): void {
  editorTextarea.addEventListener("blur", () => setTimeout(checkForCompletedCommands, 100));
}
