import { applyStoredAccent } from "../shared/accent.ts";
import { bindThemeToggle } from "../shared/theme.ts";
import { initPromptStorage } from "../storage/active-prompt-store.ts";
import { bindAutosave } from "./autosave.ts";
import { loadBlocks } from "./custom-blocks.ts";
import { bindEditorInput } from "./editor-input.ts";
import { copyButton, themeToggleButton } from "./elements.ts";
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

/** Copies the whole prompt to the clipboard and flashes the button green. */
function bindCopyButton(): void {
  copyButton.onclick = async () => {
    await navigator.clipboard.writeText(editorState.currentPrompt?.content ?? "");
    copyButton.classList.add("ok");
    setTimeout(() => copyButton.classList.remove("ok"), 1200);
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
