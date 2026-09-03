import { applyStoredAccent } from "../shared/accent.ts";
import { bindThemeToggle } from "../shared/theme.ts";
import { initPromptStorage } from "../storage/active-prompt-store.ts";
import { bindAutosave } from "./autosave.ts";
import { loadBlocks } from "./custom-blocks.ts";
import { bindEditorInput } from "./editor-input.ts";
import { copiedNote, copyButton, themeToggleButton } from "./elements.ts";
import { bindFolderTree, renderTree } from "./folder-tree.ts";
import { refreshHighlight } from "./highlight-layer.ts";
import { bindEditorKeydown } from "./key-handlers.ts";
import { refreshLibrary } from "./library.ts";
import { loadPermanentTags } from "./permanent-tags.ts";
import { bindPromptCanvas } from "./prompt-canvas.ts";
import { openInitialPrompt } from "./prompt-actions.ts";
import { bindRailResize } from "./rail-resize.ts";
import { bindSettingsPane } from "./settings-pane.ts";
import { editorState } from "./state.ts";
import { bindStorageBar } from "./storage-bar.ts";
import { bindSuggestionDismissal } from "./suggestions.ts";
import { bindTooltip } from "./tooltip.ts";
import { bindViewToggle, setView } from "./view-toggle.ts";

const COPIED_NOTE_MS = 1400;
let copiedNoteTimer: ReturnType<typeof setTimeout> | null = null;

/** Copies the whole prompt to the clipboard, flashes the button green and shows "Copied!" beside it for a moment. */
function bindCopyButton(): void {
  copyButton.onclick = async () => {
    let copied = true;
    try {
      await navigator.clipboard.writeText(editorState.currentPrompt?.content ?? "");
    } catch {
      copied = false;
    }
    copiedNote.textContent = copied ? "Copied!" : "Copy blocked by the browser";
    copiedNote.classList.toggle("bad", !copied);
    copiedNote.hidden = false;
    copyButton.classList.toggle("ok", copied);
    if (copiedNoteTimer) clearTimeout(copiedNoteTimer);
    copiedNoteTimer = setTimeout(() => {
      copiedNote.hidden = true;
      copyButton.classList.remove("ok");
    }, COPIED_NOTE_MS);
  };
}

/** Settings saved in another tab of the app: reload the XML view's autocomplete data. */
function bindSharedDataRefresh(): void {
  window.addEventListener("storage", () => { loadBlocks(); loadPermanentTags(); });
}

async function startEditor(): Promise<void> {
  applyStoredAccent();
  bindThemeToggle(themeToggleButton);
  bindCopyButton();
  bindFolderTree();
  bindTooltip();
  bindRailResize();
  bindAutosave();
  bindEditorKeydown();
  bindEditorInput();
  bindSuggestionDismissal();
  bindSharedDataRefresh();
  bindPromptCanvas();
  bindViewToggle();
  bindSettingsPane();

  refreshHighlight();
  setView("blocks");
  loadBlocks();
  loadPermanentTags();
  await initPromptStorage();
  bindStorageBar();
  await refreshLibrary();
  renderTree();
  await openInitialPrompt();
}

startEditor();
