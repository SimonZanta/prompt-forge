import { describe, expect, test } from "bun:test";
import {
  childPath, createPromptStore, folderNameOf, isValidName, isValidPath, isWithin, parentPathOf, type PromptStoreBackend,
} from "./prompt-store.ts";

/** In-memory backend so the validation layer can be tested without IndexedDB or a real folder. */
function createMemoryBackend(): PromptStoreBackend {
  const folders = new Map<string, Map<string, string>>();
  const folder = (path: string) => folders.get(path)!;
  return {
    listFolders: async () => [...folders].map(([path, prompts]) => ({ path, name: folderNameOf(path), prompt_count: prompts.size })),
    folderExists: async (path) => folders.has(path),
    createFolder: async (path) => { folders.set(path, new Map()); },
    renameFolder: async (path, newPath) => {
      for (const [key, prompts] of [...folders]) {
        if (!isWithin(key, path)) continue;
        folders.delete(key);
        folders.set(newPath + key.slice(path.length), prompts);
      }
    },
    deleteFolder: async (path) => { folders.delete(path); },
    listPrompts: async (path) => [...folder(path).keys()].map((prompt) => ({ name: prompt, updated_at: "" })),
    promptExists: async (path, prompt) => folder(path).has(prompt),
    readPrompt: async (path, prompt) => folder(path).get(prompt)!,
    writePrompt: async (path, prompt, content) => { folder(path).set(prompt, content); },
    renamePrompt: async (path, prompt, newPrompt) => { folder(path).set(newPrompt, folder(path).get(prompt)!); folder(path).delete(prompt); },
    movePrompt: async (path, prompt, target) => { folder(target).set(prompt, folder(path).get(prompt)!); folder(path).delete(prompt); },
    deletePrompt: async (path, prompt) => { folder(path).delete(prompt); },
  };
}

describe("names and paths", () => {
  test("accepts ordinary names, including non-ASCII", () => {
    expect(isValidName("default")).toBe(true);
    expect(isValidName("sql exporty")).toBe(true);
    expect(isValidName("vývoj aplikace")).toBe(true);
  });
  test("rejects path-unsafe names", () => {
    for (const bad of ["", "a/b", "a\\b", ".hidden", "trailing.", "trailing ", " lead", "a:b", "x".repeat(101)]) {
      expect(isValidName(bad)).toBe(false);
    }
  });
  test("path helpers", () => {
    expect(isValidPath("vývoj aplikace/archiv")).toBe(true);
    expect(isValidPath("a//b")).toBe(false);
    expect(isValidPath("")).toBe(false);
    expect(parentPathOf("a/b/c")).toBe("a/b");
    expect(parentPathOf("a")).toBeNull();
    expect(folderNameOf("a/b/c")).toBe("c");
    expect(childPath(null, "a")).toBe("a");
    expect(childPath("a/b", "c")).toBe("a/b/c");
    expect(isWithin("a/b", "a")).toBe(true);
    expect(isWithin("ab", "a")).toBe(false);
    expect(isWithin("a", "a")).toBe(true);
  });
});

describe("createPromptStore", () => {
  test("creates, lists, renames and deletes folders", async () => {
    const store = createPromptStore(createMemoryBackend());
    expect(await store.createFolder("work")).toEqual({ path: "work", name: "work", prompt_count: 0 });
    expect(store.createFolder("work")).rejects.toThrow("duplicate folder");
    expect(store.createFolder("bad/name")).rejects.toThrow("folder not found"); // parent "bad" does not exist
    expect(store.createFolder("bad:name")).rejects.toThrow("invalid folder name");
    expect(await store.renameFolder("work", "play")).toEqual({ path: "play", name: "play", prompt_count: 0 });
    expect((await store.listFolders()).map((folder) => folder.path)).toEqual(["play"]);
    await store.deleteFolder("play");
    expect(store.deleteFolder("play")).rejects.toThrow("folder not found");
  });

  test("nested folders: rename moves the subtree, delete needs an empty folder", async () => {
    const store = createPromptStore(createMemoryBackend());
    await store.createFolder("vývoj aplikace");
    await store.createFolder("vývoj aplikace/archiv");
    await store.createPrompt("vývoj aplikace/archiv", "old", "<prompt/>");
    expect(store.deleteFolder("vývoj aplikace")).rejects.toThrow("folder is not empty");
    expect(store.deleteFolder("vývoj aplikace/archiv")).rejects.toThrow("folder is not empty");

    expect(await store.renameFolder("vývoj aplikace", "dev")).toEqual({ path: "dev", name: "dev", prompt_count: 0 });
    expect((await store.listFolders()).map((folder) => folder.path).sort()).toEqual(["dev", "dev/archiv"]);
    expect(await store.readPrompt("dev/archiv", "old")).toEqual({ name: "old", content: "<prompt/>" });

    await store.deletePrompt("dev/archiv", "old");
    await store.deleteFolder("dev/archiv");
    await store.deleteFolder("dev");
    expect(await store.listFolders()).toEqual([]);
  });

  test("renaming a folder to its own name is a no-op", async () => {
    const store = createPromptStore(createMemoryBackend());
    await store.createFolder("work");
    await store.renameFolder("work", "work");
    expect((await store.listFolders()).map((folder) => folder.name)).toEqual(["work"]);
  });

  test("creates, reads, writes, renames and deletes prompts", async () => {
    const store = createPromptStore(createMemoryBackend());
    await store.createFolder("work");
    expect(await store.createPrompt("work", "Tasks", "<tasks/>")).toEqual({ name: "Tasks", content: "<tasks/>" });
    expect(store.createPrompt("work", "Tasks", "")).rejects.toThrow("duplicate prompt");
    expect(store.createPrompt("nope", "Tasks", "")).rejects.toThrow("folder not found");
    expect(store.createPrompt("work", "bad:name", "")).rejects.toThrow("invalid prompt name");

    await store.writePrompt("work", "Tasks", "<tasks>1</tasks>");
    expect(await store.readPrompt("work", "Tasks")).toEqual({ name: "Tasks", content: "<tasks>1</tasks>" });
    expect(store.writePrompt("work", "Missing", "")).rejects.toThrow("prompt not found");

    expect(await store.renamePrompt("work", "Tasks", "Todo")).toEqual({ name: "Todo", content: "<tasks>1</tasks>" });
    await store.createPrompt("work", "Other", "");
    expect(store.renamePrompt("work", "Todo", "Other")).rejects.toThrow("duplicate prompt");
    expect((await store.listPrompts("work")).map((prompt) => prompt.name).sort()).toEqual(["Other", "Todo"]);

    await store.deletePrompt("work", "Todo");
    expect(store.readPrompt("work", "Todo")).rejects.toThrow("prompt not found");
  });

  test("moves prompts between folders, refusing missing targets and name clashes", async () => {
    const store = createPromptStore(createMemoryBackend());
    await store.createFolder("work");
    await store.createFolder("work/archive");
    await store.createPrompt("work", "Tasks", "<tasks/>");
    await store.createPrompt("work/archive", "Old", "<old/>");
    expect(store.movePrompt("work", "Tasks", "nope")).rejects.toThrow("folder not found");
    expect(store.movePrompt("work", "Missing", "work/archive")).rejects.toThrow("prompt not found");
    await store.movePrompt("work", "Tasks", "work"); // no-op
    await store.movePrompt("work", "Tasks", "work/archive");
    expect((await store.listPrompts("work")).map((prompt) => prompt.name)).toEqual([]);
    expect(await store.readPrompt("work/archive", "Tasks")).toEqual({ name: "Tasks", content: "<tasks/>" });
    await store.createPrompt("work", "Old", "");
    expect(store.movePrompt("work/archive", "Old", "work")).rejects.toThrow("duplicate prompt");
  });
});
