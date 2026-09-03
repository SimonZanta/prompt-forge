/**
 * Prompt storage: folders of `.xml` prompt files. Two backends exist — the browser's IndexedDB
 * (`browser-prompt-store.ts`, works everywhere, no setup) and a folder on disk opened with the
 * File System Access API (`folder-prompt-store.ts`). `createPromptStore` adds the name validation and
 * duplicate / existence checks on top of a backend so both behave identically.
 */

export interface Folder {
  name: string;
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

/** What the editor talks to. Rejects with `StorageError` for invalid names, duplicates and missing entries. */
export interface PromptStore {
  listFolders(): Promise<Folder[]>;
  createFolder(name: string): Promise<Folder>;
  renameFolder(folder: string, newName: string): Promise<void>;
  deleteFolder(folder: string): Promise<void>;
  listPrompts(folder: string): Promise<PromptListItem[]>;
  readPrompt(folder: string, name: string): Promise<Prompt>;
  createPrompt(folder: string, name: string, content: string): Promise<Prompt>;
  writePrompt(folder: string, name: string, content: string): Promise<void>;
  renamePrompt(folder: string, name: string, newName: string): Promise<Prompt>;
  deletePrompt(folder: string, name: string): Promise<void>;
}

/** Raw operations a backend implements; callers are guaranteed valid names and existing entries. */
export interface PromptStoreBackend {
  listFolders(): Promise<Folder[]>;
  folderExists(folder: string): Promise<boolean>;
  createFolder(folder: string): Promise<void>;
  renameFolder(folder: string, newName: string): Promise<void>;
  deleteFolder(folder: string): Promise<void>;
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

/** Wraps a backend with the shared validation rules. */
export function createPromptStore(backend: PromptStoreBackend): PromptStore {
  async function requireFolder(folder: string): Promise<void> {
    if (!isValidName(folder)) throw new StorageError("invalid folder name");
    if (!(await backend.folderExists(folder))) throw new StorageError("folder not found");
  }

  async function requirePrompt(folder: string, name: string): Promise<void> {
    await requireFolder(folder);
    if (!isValidName(name)) throw new StorageError("invalid prompt name");
    if (!(await backend.promptExists(folder, name))) throw new StorageError("prompt not found");
  }

  async function requireFreeFolderName(name: string): Promise<void> {
    if (!isValidName(name)) throw new StorageError("invalid folder name");
    if (await backend.folderExists(name)) throw new StorageError("duplicate folder");
  }

  async function requireFreePromptName(folder: string, name: string): Promise<void> {
    if (!isValidName(name)) throw new StorageError("invalid prompt name");
    if (await backend.promptExists(folder, name)) throw new StorageError("duplicate prompt");
  }

  return {
    listFolders: () => backend.listFolders(),

    async createFolder(name) {
      await requireFreeFolderName(name);
      await backend.createFolder(name);
      return { name, prompt_count: 0 };
    },

    async renameFolder(folder, newName) {
      await requireFolder(folder);
      if (newName === folder) return;
      await requireFreeFolderName(newName);
      await backend.renameFolder(folder, newName);
    },

    async deleteFolder(folder) {
      await requireFolder(folder);
      await backend.deleteFolder(folder);
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
