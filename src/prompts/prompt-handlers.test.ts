import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "path";
import {
  handleCreateFolder,
  handleCreatePrompt,
  handleDeleteFolder,
  handleDeletePrompt,
  handleGetPrompt,
  handleListFolders,
  handleListPrompts,
  handleRenameFolder,
  handleUpdatePrompt,
} from "./prompt-handlers.ts";

const tempDirs: string[] = [];

function createTestPromptsDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "prompt-forge-test-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function jsonRequest(method: string, body: unknown): Request {
  return new Request("http://localhost/api/folders", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("folder handlers", () => {
  test("create then list", async () => {
    const dir = createTestPromptsDir();
    const created = await handleCreateFolder(dir, jsonRequest("POST", { name: "work" }));
    expect(created.status).toBe(201);

    const listed = await handleListFolders(dir).json();
    expect(listed).toEqual([{ name: "work", prompt_count: 0 }]);
  });

  test("rejects invalid and duplicate folder names", async () => {
    const dir = createTestPromptsDir();
    expect((await handleCreateFolder(dir, jsonRequest("POST", { name: "a/b" }))).status).toBe(400);
    expect((await handleCreateFolder(dir, jsonRequest("POST", { name: ".hidden" }))).status).toBe(400);
    await handleCreateFolder(dir, jsonRequest("POST", { name: "work" }));
    expect((await handleCreateFolder(dir, jsonRequest("POST", { name: "work" }))).status).toBe(409);
  });

  test("rename moves the folder and its prompts", async () => {
    const dir = createTestPromptsDir();
    await handleCreateFolder(dir, jsonRequest("POST", { name: "work" }));
    await handleCreatePrompt(dir, jsonRequest("POST", { name: "A", content: "<a/>" }), "work");

    const renamed = await handleRenameFolder(dir, jsonRequest("PUT", { name: "personal" }), "work");
    expect(await renamed.json()).toEqual({ name: "personal" });
    const listed = await handleListFolders(dir).json();
    expect(listed).toEqual([{ name: "personal", prompt_count: 1 }]);
  });

  test("rename to an existing folder returns 409", async () => {
    const dir = createTestPromptsDir();
    await handleCreateFolder(dir, jsonRequest("POST", { name: "a" }));
    await handleCreateFolder(dir, jsonRequest("POST", { name: "b" }));
    expect((await handleRenameFolder(dir, jsonRequest("PUT", { name: "b" }), "a")).status).toBe(409);
  });

  test("delete removes the folder and everything inside", async () => {
    const dir = createTestPromptsDir();
    await handleCreateFolder(dir, jsonRequest("POST", { name: "work" }));
    await handleCreatePrompt(dir, jsonRequest("POST", { name: "A" }), "work");
    expect(handleDeleteFolder(dir, "work").status).toBe(200);
    expect(await handleListFolders(dir).json()).toEqual([]);
  });

  test("operations on an unknown folder return 404", async () => {
    const dir = createTestPromptsDir();
    expect((await handleRenameFolder(dir, jsonRequest("PUT", { name: "x" }), "nope")).status).toBe(404);
    expect(handleDeleteFolder(dir, "nope").status).toBe(404);
    expect(handleListPrompts(dir, "nope").status).toBe(404);
  });
});

describe("prompt handlers", () => {
  async function createFolderWithPrompt(name = "A", content = "<a/>"): Promise<string> {
    const dir = createTestPromptsDir();
    await handleCreateFolder(dir, jsonRequest("POST", { name: "work" }));
    await handleCreatePrompt(dir, jsonRequest("POST", { name, content }), "work");
    return dir;
  }

  test("create then list and read back", async () => {
    const dir = await createFolderWithPrompt();
    const listed = await handleListPrompts(dir, "work").json();
    expect(listed).toHaveLength(1);
    expect(listed[0].name).toBe("A");

    const prompt = await handleGetPrompt(dir, "work", "A").json();
    expect(prompt).toEqual({ name: "A", content: "<a/>" });
  });

  test("rejects invalid and duplicate prompt names", async () => {
    const dir = await createFolderWithPrompt();
    expect((await handleCreatePrompt(dir, jsonRequest("POST", { name: "a/b" }), "work")).status).toBe(400);
    expect((await handleCreatePrompt(dir, jsonRequest("POST", { name: "A" }), "work")).status).toBe(409);
  });

  test("update rewrites content and keeps the name when omitted", async () => {
    const dir = await createFolderWithPrompt();
    const updated = await (await handleUpdatePrompt(dir, jsonRequest("PUT", { content: "<b/>" }), "work", "A")).json();
    expect(updated).toEqual({ name: "A", content: "<b/>" });
  });

  test("update renames the file, keeping content when omitted", async () => {
    const dir = await createFolderWithPrompt();
    const updated = await (await handleUpdatePrompt(dir, jsonRequest("PUT", { name: "B" }), "work", "A")).json();
    expect(updated).toEqual({ name: "B", content: "<a/>" });
    expect(handleGetPrompt(dir, "work", "A").status).toBe(404);
  });

  test("rename to an existing prompt returns 409", async () => {
    const dir = await createFolderWithPrompt();
    await handleCreatePrompt(dir, jsonRequest("POST", { name: "B" }), "work");
    expect((await handleUpdatePrompt(dir, jsonRequest("PUT", { name: "B" }), "work", "A")).status).toBe(409);
  });

  test("update and delete of an unknown prompt return 404", async () => {
    const dir = await createFolderWithPrompt();
    expect((await handleUpdatePrompt(dir, jsonRequest("PUT", {}), "work", "nope")).status).toBe(404);
    expect(handleDeletePrompt(dir, "work", "nope").status).toBe(404);
  });

  test("delete removes the prompt", async () => {
    const dir = await createFolderWithPrompt();
    expect(handleDeletePrompt(dir, "work", "A").status).toBe(200);
    expect(await handleListPrompts(dir, "work").json()).toHaveLength(0);
  });
});
