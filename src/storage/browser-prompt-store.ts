import { IDB_STORES, idbGet, idbGetAll, idbGetAllKeys, idbSet, withStore } from "./idb.ts";
import { EXAMPLE_PROMPT_CONTENT, EXAMPLE_PROMPT_TITLE } from "./prompt-defaults.ts";
import {
  createPromptStore, folderNameOf, isWithin,
  type Folder, type PromptListItem, type PromptStore, type PromptStoreBackend,
} from "./prompt-store.ts";

/**
 * Prompts kept in the browser's IndexedDB — the default, zero-setup storage.
 * Folders are rows keyed by their path (`default`, `default/archive`); prompts are rows keyed by
 * `folderPath/name`. Because a nested folder's prompts share the key prefix of its parent, prompt
 * lookups by folder always also check the row's own `folder` field. Rows written by the flat, pre-tree
 * version of the app are already in this shape (a top-level path is just the name), so nothing migrates.
 */

interface FolderRow {
  path: string;
}

interface PromptRow {
  folder: string;
  name: string;
  content: string;
  updated_at: string;
}

const SEEDED_MARKER = "browser-store-seeded";

const promptKey = (folder: string, name: string) => folder + "/" + name;
/** Every prompt row under `folder` — direct prompts and, by prefix, those of its subfolders. */
const subtreeRange = (folder: string) => IDBKeyRange.bound(folder + "/", folder + "/\uffff");

async function readFolderPrompts(folder: string): Promise<PromptRow[]> {
  return (await idbGetAll<PromptRow>(IDB_STORES.prompts, subtreeRange(folder))).filter((row) => row.folder === folder);
}

const browserBackend: PromptStoreBackend = {
  async listFolders(): Promise<Folder[]> {
    const paths = (await idbGetAllKeys(IDB_STORES.folders)).map(String);
    const prompts = await idbGetAll<PromptRow>(IDB_STORES.prompts);
    return paths
      .map((path) => ({ path, name: folderNameOf(path), prompt_count: prompts.filter((row) => row.folder === path).length }))
      .sort((a, b) => a.path.localeCompare(b.path));
  },

  async folderExists(path) {
    return (await idbGet<FolderRow>(IDB_STORES.folders, path)) !== undefined;
  },

  createFolder: (path) => idbSet(IDB_STORES.folders, path, { path } satisfies FolderRow),

  async renameFolder(path, newPath) {
    const rekey = (key: string) => newPath + key.slice(path.length);
    const folderPaths = (await idbGetAllKeys(IDB_STORES.folders)).map(String).filter((key) => isWithin(key, path));
    const prompts = (await idbGetAll<PromptRow>(IDB_STORES.prompts, subtreeRange(path))).filter((row) => isWithin(row.folder, path));
    await withStore(IDB_STORES.prompts, "readwrite", (store) => {
      for (const row of prompts) {
        store.delete(promptKey(row.folder, row.name));
        const folder = rekey(row.folder);
        store.put({ ...row, folder }, promptKey(folder, row.name));
      }
    });
    await withStore(IDB_STORES.folders, "readwrite", (store) => {
      for (const key of folderPaths) {
        store.delete(key);
        store.put({ path: rekey(key) } satisfies FolderRow, rekey(key));
      }
    });
  },

  deleteFolder: (path) => withStore(IDB_STORES.folders, "readwrite", (store) => { store.delete(path); }),

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
