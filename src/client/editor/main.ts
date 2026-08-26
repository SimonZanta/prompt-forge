import { bindThemeToggle } from "../shared/theme.ts";
import { bindAutosave } from "./autosave.ts";
import { loadBlocks } from "./custom-blocks.ts";
import { bindEditorInput } from "./editor-input.ts";
import { copyButton, editorTextarea, themeToggleButton } from "./elements.ts";
import { refreshHighlight } from "./highlight-layer.ts";
import { bindEditorKeydown } from "./key-handlers.ts";
import { bindNameDialog } from "./modal.ts";
import { loadPermanentTags } from "./permanent-tags.ts";
import { bindTemplateMenu, loadPrompts } from "./prompt-list.ts";
import { bindSuggestionDismissal } from "./suggestions.ts";

/** Copies the whole prompt to the clipboard and flashes the button green. */
function bindCopyButton(): void {
  copyButton.onclick = async () => {
    await navigator.clipboard.writeText(editorTextarea.value);
    copyButton.classList.add("ok");
    setTimeout(() => copyButton.classList.remove("ok"), 1200);
  };
}

/** Blocks and tags are edited on the settings page; reload them whenever the user comes back to this tab. */
function bindSharedDataRefresh(): void {
  const refresh = () => { loadBlocks(); loadPermanentTags(); };
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });
  window.addEventListener("focus", refresh);
}

async function startEditor(): Promise<void> {
  bindThemeToggle(themeToggleButton);
  bindCopyButton();
  bindNameDialog();
  bindTemplateMenu();
  bindAutosave();
  bindEditorKeydown();
  bindEditorInput();
  bindSuggestionDismissal();
  bindSharedDataRefresh();

  refreshHighlight();
  await Promise.all([loadBlocks(), loadPermanentTags()]);
  await loadPrompts();
}

startEditor();
