import { describe, expect, test } from "bun:test";
import { createPromptStore, isValidName, type PromptStoreBackend } from "./prompt-store.ts";

/** In-memory backend so the validation layer can be tested without IndexedDB or a real folder. */
function createMemoryBackend(): PromptStoreBackend {
  const folders = new Map<string, Map<string, string>>();
  const folder = (name: string) => folders.get(name)!;
  return {
    listFolders: async () => [...folders].map(([name, prompts]) => ({ name, prompt_count: prompts.size })),
    folderExists: async (name) => folders.has(name),
    createFolder: async (name) => { folders.set(name, new Map()); },
    renameFolder: async (name, newName) => { folders.set(newName, folder(name)); folders.delete(name); },
    deleteFolder: async (name) => { folders.delete(name); },
    listPrompts: async (name) => [...folder(name).keys()].map((prompt) => ({ name: prompt, updated_at: "" })),
    promptExists: async (name, prompt) => folder(name).has(prompt),
    readPrompt: async (name, prompt) => folder(name).get(prompt)!,
    writePrompt: async (name, prompt, content) => { folder(name).set(prompt, content); },
    renamePrompt: async (name, prompt, newPrompt) => { folder(name).set(newPrompt, folder(name).get(prompt)!); folder(name).delete(prompt); },
    deletePrompt: async (name, prompt) => { folder(name).delete(prompt); },
  };
}

describe("isValidName", () => {
  test("accepts ordinary names", () => {
    expect(isValidName("default")).toBe(true);
    expect(isValidName("sql exporty")).toBe(true);
  });
  test("rejects path-unsafe names", () => {
    for (const bad of ["", "a/b", "a\\b", ".hidden", "trailing.", "trailing ", " lead", "a:b", "x".repeat(101)]) {
      expect(isValidName(bad)).toBe(false);
    }
  });
});

describe("createPromptStore", () => {
  test("creates, lists, renames and deletes folders", async () => {
    const store = createPromptStore(createMemoryBackend());
    expect(await store.createFolder("work")).toEqual({ name: "work", prompt_count: 0 });
    expect(store.createFolder("work")).rejects.toThrow("duplicate folder");
    expect(store.createFolder("bad/name")).rejects.toThrow("invalid folder name");
    await store.renameFolder("work", "play");
    expect((await store.listFolders()).map((folder) => folder.name)).toEqual(["play"]);
    await store.deleteFolder("play");
    expect(store.deleteFolder("play")).rejects.toThrow("folder not found");
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
});
