import {
  createPromptStore,
  isValidName,
  type Folder,
  type PromptListItem,
  type PromptStore,
  type PromptStoreBackend,
} from "./prompt-store.ts";

/**
 * Prompts as real files: `<picked folder>/<folder>/<name>.xml`, via the File System Access API.
 * Sub-directories are folders, `.xml` files are prompts; anything else in the tree is ignored.
 * Renames are copy + delete because `FileSystemHandle.move()` is not available for user-picked folders.
 */

const PROMPT_EXTENSION = ".xml";

function isNotFound(error: unknown): boolean {
  return error instanceof DOMException && error.name === "NotFoundError";
}

async function readText(directory: FileSystemDirectoryHandle, fileName: string): Promise<string> {
  const file = await (await directory.getFileHandle(fileName)).getFile();
  return file.text();
}

async function writeText(directory: FileSystemDirectoryHandle, fileName: string, content: string): Promise<void> {
  const writable = await (await directory.getFileHandle(fileName, { create: true })).createWritable();
  await writable.write(content);
  await writable.close();
}

async function listXmlFileNames(directory: FileSystemDirectoryHandle): Promise<string[]> {
  const names: string[] = [];
  for await (const [name, handle] of directory.entries()) {
    if (handle.kind === "file" && name.endsWith(PROMPT_EXTENSION)) names.push(name);
  }
  return names;
}

export function createFolderPromptStore(root: FileSystemDirectoryHandle): PromptStore {
  const folderHandle = (folder: string, create = false) => root.getDirectoryHandle(folder, { create });

  const backend: PromptStoreBackend = {
    async listFolders(): Promise<Folder[]> {
      const folders: Folder[] = [];
      for await (const [name, handle] of root.entries()) {
        if (handle.kind !== "directory" || !isValidName(name)) continue;
        const directory = handle as FileSystemDirectoryHandle;
        folders.push({ name, prompt_count: (await listXmlFileNames(directory)).length });
      }
      return folders.sort((a, b) => a.name.localeCompare(b.name));
    },

    async folderExists(folder) {
      try {
        await folderHandle(folder);
        return true;
      } catch (error) {
        if (isNotFound(error)) return false;
        throw error;
      }
    },

    async createFolder(folder) {
      await folderHandle(folder, true);
    },

    async renameFolder(folder, newName) {
      const source = await folderHandle(folder);
      const target = await folderHandle(newName, true);
      for (const fileName of await listXmlFileNames(source)) {
        await writeText(target, fileName, await readText(source, fileName));
      }
      await root.removeEntry(folder, { recursive: true });
    },

    deleteFolder: (folder) => root.removeEntry(folder, { recursive: true }),

    async listPrompts(folder): Promise<PromptListItem[]> {
      const directory = await folderHandle(folder);
      const items: PromptListItem[] = [];
      for (const fileName of await listXmlFileNames(directory)) {
        const file = await (await directory.getFileHandle(fileName)).getFile();
        items.push({ name: fileName.slice(0, -PROMPT_EXTENSION.length), updated_at: new Date(file.lastModified).toISOString() });
      }
      return items.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    },

    async promptExists(folder, name) {
      try {
        await (await folderHandle(folder)).getFileHandle(name + PROMPT_EXTENSION);
        return true;
      } catch (error) {
        if (isNotFound(error)) return false;
        throw error;
      }
    },

    async readPrompt(folder, name) {
      return readText(await folderHandle(folder), name + PROMPT_EXTENSION);
    },

    async writePrompt(folder, name, content) {
      await writeText(await folderHandle(folder), name + PROMPT_EXTENSION, content);
    },

    async renamePrompt(folder, name, newName) {
      const directory = await folderHandle(folder);
      await writeText(directory, newName + PROMPT_EXTENSION, await readText(directory, name + PROMPT_EXTENSION));
      await directory.removeEntry(name + PROMPT_EXTENSION);
    },

    async deletePrompt(folder, name) {
      await (await folderHandle(folder)).removeEntry(name + PROMPT_EXTENSION);
    },
  };

  return createPromptStore(backend);
}
