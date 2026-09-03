import { applyStoredAccent } from "../shared/accent.ts";
import { bindThemeToggle } from "../shared/theme.ts";
import { initPromptStorage } from "../storage/active-prompt-store.ts";
import { bindAutosave } from "./autosave.ts";
import { loadBlocks } from "./custom-blocks.ts";
import { bindEditorInput } from "./editor-input.ts";
import { copyButton, themeToggleButton } from "./elements.ts";
import { bindFolderNavigation, refreshFolders } from "./folder-list.ts";
import { refreshHighlight } from "./highlight-layer.ts";
import { bindEditorKeydown } from "./key-handlers.ts";
import { bindNameDialog } from "./modal.ts";
import { loadPermanentTags } from "./permanent-tags.ts";
import { bindPromptCanvas } from "./prompt-canvas.ts";
import { bindNewPromptButton } from "./prompt-list.ts";
import { editorState } from "./state.ts";
import { bindStorageBar } from "./storage-bar.ts";
import { bindSuggestionDismissal } from "./suggestions.ts";
import { bindViewToggle, setView } from "./view-toggle.ts";

/** Copies the whole prompt to the clipboard and flashes the button green. */
function bindCopyButton(): void {
  copyButton.onclick = async () => {
    await navigator.clipboard.writeText(editorState.currentPrompt?.content ?? "");
    copyButton.classList.add("ok");
    setTimeout(() => copyButton.classList.remove("ok"), 1200);
  };
}

/** Blocks and tags are edited on the settings page (another tab); reload them when they change or the user comes back. */
function bindSharedDataRefresh(): void {
  const refresh = () => { loadBlocks(); loadPermanentTags(); };
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });
  window.addEventListener("focus", refresh);
  window.addEventListener("storage", refresh);
}

async function startEditor(): Promise<void> {
  applyStoredAccent();
  bindThemeToggle(themeToggleButton);
  bindCopyButton();
  bindNameDialog();
  bindFolderNavigation();
  bindNewPromptButton();
  bindAutosave();
  bindEditorKeydown();
  bindEditorInput();
  bindSuggestionDismissal();
  bindSharedDataRefresh();
  bindPromptCanvas();
  bindViewToggle();

  refreshHighlight();
  setView("blocks");
  loadBlocks();
  loadPermanentTags();
  await initPromptStorage();
  bindStorageBar();
  await refreshFolders();
}

startEditor();
