import { browserPromptStore, seedBrowserStoreIfEmpty } from "./browser-prompt-store.ts";
import {
  clearDirectoryHandle,
  hasDirectoryPermission,
  loadDirectoryHandle,
  pickDirectory,
  requestDirectoryPermission,
  saveDirectoryHandle,
} from "./directory-handle.ts";
import { createFolderPromptStore } from "./folder-prompt-store.ts";
import { StorageError, type PromptStore } from "./prompt-store.ts";

/**
 * Which prompt store the editor is using. Starts in browser storage; "Open folder" switches to a
 * folder on disk and remembers it (mode flag in localStorage, directory handle in IndexedDB).
 */

export type StorageStatus =
  | { mode: "browser" }
  | { mode: "folder"; folderName: string }
  /** A folder is remembered but the browser wants a click before granting access again. */
  | { mode: "folder-locked"; folderName: string };

const MODE_KEY = "storage-mode";

let activeStore: PromptStore = browserPromptStore;
let status: StorageStatus = { mode: "browser" };
/** The remembered handle while access is still locked. */
let pendingHandle: FileSystemDirectoryHandle | null = null;

/** Store whose every method fails until the user reconnects the folder. */
const lockedStore: PromptStore = new Proxy({} as PromptStore, {
  get: () => () => Promise.reject(new StorageError("folder access not granted yet")),
});

export const promptStore = (): PromptStore => activeStore;
export const storageStatus = (): StorageStatus => status;

function useFolder(handle: FileSystemDirectoryHandle): void {
  activeStore = createFolderPromptStore(handle);
  status = { mode: "folder", folderName: handle.name };
  pendingHandle = null;
  try { localStorage.setItem(MODE_KEY, "folder"); } catch { /* storage may be unavailable */ }
}

async function useBrowser(): Promise<void> {
  await seedBrowserStoreIfEmpty();
  activeStore = browserPromptStore;
  status = { mode: "browser" };
  pendingHandle = null;
  try { localStorage.setItem(MODE_KEY, "browser"); } catch { /* storage may be unavailable */ }
}

/** Restores the last used storage; call once at startup before touching `promptStore()`. */
export async function initPromptStorage(): Promise<StorageStatus> {
  let mode: string | null = null;
  try { mode = localStorage.getItem(MODE_KEY); } catch { /* storage may be unavailable */ }

  const handle = mode === "folder" ? await loadDirectoryHandle() : undefined;
  if (!handle) {
    await useBrowser();
  } else if (await hasDirectoryPermission(handle)) {
    useFolder(handle);
  } else {
    pendingHandle = handle;
    activeStore = lockedStore;
    status = { mode: "folder-locked", folderName: handle.name };
  }
  return status;
}

/** Lets the user pick a folder and switches to it; `null` when the picker was cancelled. */
export async function openFolderStorage(): Promise<StorageStatus | null> {
  const handle = await pickDirectory();
  if (!handle) return null;
  await saveDirectoryHandle(handle);
  useFolder(handle);
  return status;
}

/** Re-requests access to the remembered folder (needs a click); true when access was granted. */
export async function reconnectFolderStorage(): Promise<boolean> {
  if (!pendingHandle) return false;
  if (!(await requestDirectoryPermission(pendingHandle))) return false;
  useFolder(pendingHandle);
  return true;
}

/** Detaches the folder (files stay on disk) and goes back to browser storage. */
export async function useBrowserStorage(): Promise<void> {
  await clearDirectoryHandle();
  await useBrowser();
}

export async function countBrowserPrompts(): Promise<number> {
  const folders = await browserPromptStore.listFolders();
  return folders.reduce((sum, folder) => sum + folder.prompt_count, 0);
}

/** Copies every browser-stored prompt into `target`, keeping files that already exist there. Returns the number copied. */
export async function copyBrowserPromptsInto(target: PromptStore): Promise<number> {
  let copied = 0;
  const targetFolders = new Set((await target.listFolders()).map((folder) => folder.path));
  // sorted by path, so a parent always precedes its subfolders
  const folders = (await browserPromptStore.listFolders()).sort((a, b) => a.path.localeCompare(b.path));
  for (const folder of folders) {
    if (!targetFolders.has(folder.path)) {
      await target.createFolder(folder.path);
      targetFolders.add(folder.path);
    }
    const existing = new Set((await target.listPrompts(folder.path)).map((prompt) => prompt.name));
    for (const prompt of await browserPromptStore.listPrompts(folder.path)) {
      if (existing.has(prompt.name)) continue;
      const { content } = await browserPromptStore.readPrompt(folder.path, prompt.name);
      await target.createPrompt(folder.path, prompt.name, content);
      copied++;
    }
  }
  return copied;
}
