import { IDB_STORES, idbGet, idbGetAll, idbGetAllKeys, idbSet, withStore } from "./idb.ts";
import { EXAMPLE_PROMPT_CONTENT, EXAMPLE_PROMPT_TITLE } from "./prompt-defaults.ts";
import { createPromptStore, type Folder, type PromptListItem, type PromptStore, type PromptStoreBackend } from "./prompt-store.ts";

/**
 * Prompts kept in the browser's IndexedDB — the default, zero-setup storage.
 * Folders are rows keyed by name; prompts are rows keyed by `folder/name` (names never contain `/`),
 * so one folder's prompts are a contiguous key range.
 */

interface FolderRow {
  name: string;
}

interface PromptRow {
  folder: string;
  name: string;
  content: string;
  updated_at: string;
}

const SEEDED_MARKER = "browser-store-seeded";

const promptKey = (folder: string, name: string) => folder + "/" + name;
const folderRange = (folder: string) => IDBKeyRange.bound(folder + "/", folder + "/\uffff");

async function readFolderPrompts(folder: string): Promise<PromptRow[]> {
  return idbGetAll<PromptRow>(IDB_STORES.prompts, folderRange(folder));
}

const browserBackend: PromptStoreBackend = {
  async listFolders(): Promise<Folder[]> {
    const folders = await idbGetAll<FolderRow>(IDB_STORES.folders);
    const withCounts = await Promise.all(
      folders.map(async (folder) => ({
        name: folder.name,
        prompt_count: (await idbGetAllKeys(IDB_STORES.prompts, folderRange(folder.name))).length,
      })),
    );
    return withCounts.sort((a, b) => a.name.localeCompare(b.name));
  },

  async folderExists(folder) {
    return (await idbGet<FolderRow>(IDB_STORES.folders, folder)) !== undefined;
  },

  createFolder: (folder) => idbSet(IDB_STORES.folders, folder, { name: folder } satisfies FolderRow),

  async renameFolder(folder, newName) {
    const prompts = await readFolderPrompts(folder);
    await withStore(IDB_STORES.prompts, "readwrite", (store) => {
      for (const prompt of prompts) {
        store.delete(promptKey(folder, prompt.name));
        store.put({ ...prompt, folder: newName }, promptKey(newName, prompt.name));
      }
    });
    await withStore(IDB_STORES.folders, "readwrite", (store) => {
      store.delete(folder);
      store.put({ name: newName } satisfies FolderRow, newName);
    });
  },

  async deleteFolder(folder) {
    await withStore(IDB_STORES.prompts, "readwrite", (store) => { store.delete(folderRange(folder)); });
    await withStore(IDB_STORES.folders, "readwrite", (store) => { store.delete(folder); });
  },

  async listPrompts(folder): Promise<PromptListItem[]> {
    return (await readFolderPrompts(folder))
      .map(({ name, updated_at }) => ({ name, updated_at }))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  },

  async promptExists(folder, name) {
    return (await idbGet<PromptRow>(IDB_STORES.prompts, promptKey(folder, name))) !== undefined;
  },

  async readPrompt(folder, name) {
    return (await idbGet<PromptRow>(IDB_STORES.prompts, promptKey(folder, name)))?.content ?? "";
  },

  writePrompt(folder, name, content) {
    const row: PromptRow = { folder, name, content, updated_at: new Date().toISOString() };
    return idbSet(IDB_STORES.prompts, promptKey(folder, name), row);
  },

  async renamePrompt(folder, name, newName) {
    const row = await idbGet<PromptRow>(IDB_STORES.prompts, promptKey(folder, name));
    if (!row) return;
    await withStore(IDB_STORES.prompts, "readwrite", (store) => {
      store.delete(promptKey(folder, name));
      store.put({ ...row, name: newName }, promptKey(folder, newName));
    });
  },

  deletePrompt: (folder, name) =>
    withStore(IDB_STORES.prompts, "readwrite", (store) => { store.delete(promptKey(folder, name)); }),
};

export const browserPromptStore: PromptStore = createPromptStore(browserBackend);

/** First visit: creates the `default` folder with the example prompt. Runs once per browser. */
export async function seedBrowserStoreIfEmpty(): Promise<void> {
  if (await idbGet(IDB_STORES.meta, SEEDED_MARKER)) return;
  if ((await browserBackend.listFolders()).length === 0) {
    await browserBackend.createFolder("default");
    await browserBackend.writePrompt("default", EXAMPLE_PROMPT_TITLE, EXAMPLE_PROMPT_CONTENT);
  }
  await idbSet(IDB_STORES.meta, SEEDED_MARKER, true);
}
