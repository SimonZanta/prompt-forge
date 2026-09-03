import {
  createPromptStore,
  folderNameOf,
  isValidName,
  parentPathOf,
  pathSegments,
  type Folder,
  type PromptListItem,
  type PromptStore,
  type PromptStoreBackend,
} from "./prompt-store.ts";

/**
 * Prompts as real files: `<picked folder>/<path…>/<name>.xml`, via the File System Access API.
 * Directories are folders (nested to any depth), `.xml` files are prompts; anything else is ignored
 * but preserved. Renames are copy + delete because `FileSystemHandle.move()` is not available for
 * user-picked folders.
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

/** Copies every entry (files of any kind, subdirectories) from `source` into `target`. */
async function copyDirectory(source: FileSystemDirectoryHandle, target: FileSystemDirectoryHandle): Promise<void> {
  for await (const [name, handle] of source.entries()) {
    if (handle.kind === "directory") {
      await copyDirectory(handle as FileSystemDirectoryHandle, await target.getDirectoryHandle(name, { create: true }));
    } else {
      const file = await (handle as FileSystemFileHandle).getFile();
      const writable = await (await target.getFileHandle(name, { create: true })).createWritable();
      await writable.write(await file.arrayBuffer());
      await writable.close();
    }
  }
}

export function createFolderPromptStore(root: FileSystemDirectoryHandle): PromptStore {
  /** Walks `path` segment by segment from the picked root. */
  async function directoryFor(path: string | null, create = false): Promise<FileSystemDirectoryHandle> {
    let directory = root;
    if (path === null) return directory;
    for (const segment of pathSegments(path)) directory = await directory.getDirectoryHandle(segment, { create });
    return directory;
  }

  async function walkFolders(directory: FileSystemDirectoryHandle, parent: string | null, into: Folder[]): Promise<void> {
    for await (const [name, handle] of directory.entries()) {
      if (handle.kind !== "directory" || !isValidName(name)) continue;
      const child = handle as FileSystemDirectoryHandle;
      const path = parent ? parent + "/" + name : name;
      into.push({ path, name, prompt_count: (await listXmlFileNames(child)).length });
      await walkFolders(child, path, into);
    }
  }

  const backend: PromptStoreBackend = {
    async listFolders(): Promise<Folder[]> {
      const folders: Folder[] = [];
      await walkFolders(root, null, folders);
      return folders.sort((a, b) => a.path.localeCompare(b.path));
    },

    async folderExists(path) {
      try {
        await directoryFor(path);
        return true;
      } catch (error) {
        if (isNotFound(error)) return false;
        throw error;
      }
    },

    async createFolder(path) {
      await directoryFor(path, true);
    },

    async renameFolder(path, newPath) {
      const source = await directoryFor(path);
      const parent = await directoryFor(parentPathOf(path));
      const target = await parent.getDirectoryHandle(folderNameOf(newPath), { create: true });
      await copyDirectory(source, target);
      await parent.removeEntry(folderNameOf(path), { recursive: true });
    },

    async deleteFolder(path) {
      const parent = await directoryFor(parentPathOf(path));
      // Not recursive on purpose: the store already checked for prompts and subfolders, so this only
      // fails when the directory holds other files the user should look at first.
      try {
        await parent.removeEntry(folderNameOf(path));
      } catch (error) {
        if (error instanceof DOMException && error.name === "InvalidModificationError") {
          throw new Error("folder contains other files; remove them first");
        }
        throw error;
      }
    },

    async listPrompts(folder): Promise<PromptListItem[]> {
      const directory = await directoryFor(folder);
      const items: PromptListItem[] = [];
      for (const fileName of await listXmlFileNames(directory)) {
        const file = await (await directory.getFileHandle(fileName)).getFile();
        items.push({ name: fileName.slice(0, -PROMPT_EXTENSION.length), updated_at: new Date(file.lastModified).toISOString() });
      }
      return items.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    },

    async promptExists(folder, name) {
      try {
        await (await directoryFor(folder)).getFileHandle(name + PROMPT_EXTENSION);
        return true;
      } catch (error) {
        if (isNotFound(error)) return false;
        throw error;
      }
    },

    async readPrompt(folder, name) {
      return readText(await directoryFor(folder), name + PROMPT_EXTENSION);
    },

    async writePrompt(folder, name, content) {
      await writeText(await directoryFor(folder), name + PROMPT_EXTENSION, content);
    },

    async renamePrompt(folder, name, newName) {
      const directory = await directoryFor(folder);
      await writeText(directory, newName + PROMPT_EXTENSION, await readText(directory, name + PROMPT_EXTENSION));
      await directory.removeEntry(name + PROMPT_EXTENSION);
    },

    async deletePrompt(folder, name) {
      await (await directoryFor(folder)).removeEntry(name + PROMPT_EXTENSION);
    },
  };

  return createPromptStore(backend);
}
