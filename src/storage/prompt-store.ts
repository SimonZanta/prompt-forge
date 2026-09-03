/**
 * Prompt storage: a tree of folders holding `.xml` prompt files. Two backends exist — the browser's
 * IndexedDB (`browser-prompt-store.ts`, works everywhere, no setup) and a folder on disk opened with
 * the File System Access API (`folder-prompt-store.ts`). `createPromptStore` adds name validation,
 * duplicate / existence checks and the "only empty folders can be deleted" rule on top of a backend so
 * both behave identically.
 *
 * A folder is addressed by its path: segments joined with `/`, e.g. `default/archive`. Segments are
 * validated names and never contain `/`, so paths are unambiguous.
 */

export interface Folder {
  /** `parent/child` path; a top-level folder's path is its name. */
  path: string;
  /** Last path segment. */
  name: string;
  /** Prompts directly inside this folder (not counting subfolders). */
  prompt_count: number;
}

/** Sidebar listing entry for one prompt file. */
export interface PromptListItem {
  name: string;
  updated_at: string;
}

/** A prompt file with its content. */
export interface Prompt {
  name: string;
  content: string;
}

/** What the editor talks to. Rejects with `StorageError` for invalid names, duplicates, missing entries and non-empty deletes. */
export interface PromptStore {
  /** Every folder at every depth. */
  listFolders(): Promise<Folder[]>;
  createFolder(path: string): Promise<Folder>;
  /** Renames the last segment; everything below moves with it. */
  renameFolder(path: string, newName: string): Promise<Folder>;
  /** Only allowed when the folder holds no prompts anywhere below it and no subfolders. */
  deleteFolder(path: string): Promise<void>;
  listPrompts(folder: string): Promise<PromptListItem[]>;
  readPrompt(folder: string, name: string): Promise<Prompt>;
  createPrompt(folder: string, name: string, content: string): Promise<Prompt>;
  writePrompt(folder: string, name: string, content: string): Promise<void>;
  renamePrompt(folder: string, name: string, newName: string): Promise<Prompt>;
  deletePrompt(folder: string, name: string): Promise<void>;
}

/** Raw operations a backend implements; callers are guaranteed valid paths, existing entries and (for delete) emptiness. */
export interface PromptStoreBackend {
  listFolders(): Promise<Folder[]>;
  folderExists(path: string): Promise<boolean>;
  createFolder(path: string): Promise<void>;
  renameFolder(path: string, newPath: string): Promise<void>;
  deleteFolder(path: string): Promise<void>;
  listPrompts(folder: string): Promise<PromptListItem[]>;
  promptExists(folder: string, name: string): Promise<boolean>;
  readPrompt(folder: string, name: string): Promise<string>;
  writePrompt(folder: string, name: string, content: string): Promise<void>;
  renamePrompt(folder: string, name: string, newName: string): Promise<void>;
  deletePrompt(folder: string, name: string): Promise<void>;
}

export class StorageError extends Error {}

// Names become directory / file names, so they must be a single safe path segment.
const NAME_MAX = 100;

export function isValidName(name: string): boolean {
  return (
    typeof name === "string" &&
    name.length > 0 &&
    name.length <= NAME_MAX &&
    !/[/\\<>:"|?*\x00-\x1f]/.test(name) &&
    !name.startsWith(".") &&
    !/[. ]$/.test(name) &&
    name.trim() === name
  );
}

export const pathSegments = (path: string): string[] => path.split("/");
export const isValidPath = (path: string): boolean => path.length > 0 && pathSegments(path).every(isValidName);
export const folderNameOf = (path: string): string => path.slice(path.lastIndexOf("/") + 1);
/** `null` for a top-level folder. */
export const parentPathOf = (path: string): string | null => (path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : null);
export const childPath = (parent: string | null, name: string): string => (parent ? parent + "/" + name : name);
/** True when `path` is `ancestor` itself or lies below it. */
export const isWithin = (path: string, ancestor: string): boolean => path === ancestor || path.startsWith(ancestor + "/");

/** Wraps a backend with the shared validation rules. */
export function createPromptStore(backend: PromptStoreBackend): PromptStore {
  async function requireFolder(path: string): Promise<void> {
    if (!isValidPath(path)) throw new StorageError("invalid folder name");
    if (!(await backend.folderExists(path))) throw new StorageError("folder not found");
  }

  async function requirePrompt(folder: string, name: string): Promise<void> {
    await requireFolder(folder);
    if (!isValidName(name)) throw new StorageError("invalid prompt name");
    if (!(await backend.promptExists(folder, name))) throw new StorageError("prompt not found");
  }

  async function requireFreeFolderPath(path: string): Promise<void> {
    if (!isValidPath(path)) throw new StorageError("invalid folder name");
    const parent = parentPathOf(path);
    if (parent !== null) await requireFolder(parent);
    if (await backend.folderExists(path)) throw new StorageError("duplicate folder");
  }

  async function requireFreePromptName(folder: string, name: string): Promise<void> {
    if (!isValidName(name)) throw new StorageError("invalid prompt name");
    if (await backend.promptExists(folder, name)) throw new StorageError("duplicate prompt");
  }

  return {
    listFolders: () => backend.listFolders(),

    async createFolder(path) {
      await requireFreeFolderPath(path);
      await backend.createFolder(path);
      return { path, name: folderNameOf(path), prompt_count: 0 };
    },

    async renameFolder(path, newName) {
      await requireFolder(path);
      const newPath = childPath(parentPathOf(path), newName);
      if (newPath !== path) {
        if (!isValidName(newName)) throw new StorageError("invalid folder name");
        if (await backend.folderExists(newPath)) throw new StorageError("duplicate folder");
        await backend.renameFolder(path, newPath);
      }
      return { path: newPath, name: newName, prompt_count: (await backend.listPrompts(newPath)).length };
    },

    async deleteFolder(path) {
      await requireFolder(path);
      const hasSubfolders = (await backend.listFolders()).some((folder) => folder.path !== path && isWithin(folder.path, path));
      if (hasSubfolders || (await backend.listPrompts(path)).length) throw new StorageError("folder is not empty");
      await backend.deleteFolder(path);
    },

    async listPrompts(folder) {
      await requireFolder(folder);
      return backend.listPrompts(folder);
    },

    async readPrompt(folder, name) {
      await requirePrompt(folder, name);
      return { name, content: await backend.readPrompt(folder, name) };
    },

    async createPrompt(folder, name, content) {
      await requireFolder(folder);
      await requireFreePromptName(folder, name);
      await backend.writePrompt(folder, name, content);
      return { name, content };
    },

    async writePrompt(folder, name, content) {
      await requirePrompt(folder, name);
      await backend.writePrompt(folder, name, content);
    },

    async renamePrompt(folder, name, newName) {
      await requirePrompt(folder, name);
      if (newName !== name) {
        await requireFreePromptName(folder, newName);
        await backend.renamePrompt(folder, name, newName);
      }
      return { name: newName, content: await backend.readPrompt(folder, newName) };
    },

    async deletePrompt(folder, name) {
      await requirePrompt(folder, name);
      await backend.deletePrompt(folder, name);
    },
  };
}
