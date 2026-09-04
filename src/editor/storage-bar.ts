import {
  copyBrowserPromptsInto,
  countBrowserPrompts,
  openFolderStorage,
  promptStore,
  reconnectFolderStorage,
  storageStatus,
  useBrowserStorage,
} from "../storage/active-prompt-store.ts";
import { svgIcon } from "../shared/icons.ts";
import { supportsFolderStorage } from "../storage/directory-handle.ts";
import { flushPendingSave } from "./autosave.ts";
import {
  storageLabel,
  storageOpenFolderButton,
  storageReconnectButton,
  storageUnsupportedNote,
  storageUseBrowserButton,
} from "./elements.ts";
import { renderTree } from "./folder-tree.ts";
import { refreshLibrary } from "./library.ts";
import { confirmDialog, notifyError } from "./notices.ts";
import { clearEditor, openInitialPrompt } from "./prompt-actions.ts";
import { editorState } from "./state.ts";

/** Rail row showing where prompts are stored (this browser, or a folder on disk) with the switch actions. */

export function renderStorageBar(): void {
  const status = storageStatus();
  const folderSupported = supportsFolderStorage();

  storageOpenFolderButton.hidden = !(status.mode === "browser" && folderSupported);
  storageUnsupportedNote.hidden = !(status.mode === "browser" && !folderSupported);
  storageReconnectButton.hidden = status.mode !== "folder-locked";
  storageUseBrowserButton.hidden = status.mode === "browser";

  if (status.mode === "browser") {
    storageLabel.textContent = "browser storage";
    storageLabel.title = "Prompts are kept in this browser only";
  } else {
    storageLabel.replaceChildren(svgIcon("folder"), status.folderName);
    storageLabel.title = status.mode === "folder"
      ? "Prompts are read from and saved to this folder"
      : "Click Reconnect to allow access to this folder again";
  }
}

/** Re-reads everything after the backend changed. */
async function reloadAfterSwitch(): Promise<void> {
  clearEditor();
  editorState.expandedFolders.clear();
  renderStorageBar();
  await refreshLibrary();
  renderTree();
  await openInitialPrompt();
}

async function openFolder(): Promise<void> {
  await flushPendingSave();
  const browserPromptCount = await countBrowserPrompts();
  let status;
  try {
    status = await openFolderStorage();
  } catch (error) {
    notifyError(error);
    return;
  }
  if (!status) return;
  if (browserPromptCount > 0 && status.mode === "folder" &&
      (await confirmDialog(
        `Copy ${browserPromptCount} prompt(s) from browser storage into "${status.folderName}"? Files already in the folder are kept.`,
        { confirmLabel: "Copy", cancelLabel: "Skip" }))) {
    await copyBrowserPromptsInto(promptStore());
  }
  await reloadAfterSwitch();
}

async function reconnectFolder(): Promise<void> {
  if (await reconnectFolderStorage()) await reloadAfterSwitch();
}

async function switchToBrowser(): Promise<void> {
  await flushPendingSave();
  await useBrowserStorage();
  await reloadAfterSwitch();
}

export function bindStorageBar(): void {
  storageOpenFolderButton.onclick = openFolder;
  storageReconnectButton.onclick = reconnectFolder;
  storageUseBrowserButton.onclick = switchToBrowser;
  renderStorageBar();
}
