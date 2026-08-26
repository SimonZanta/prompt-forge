import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { createPromptsTable } from "./prompt-queries.ts";
import { handleCreatePrompt, handleDeletePrompt, handleListPrompts, handleUpdatePrompt } from "./prompt-handlers.ts";

function createTestDatabase(): Database {
  const db = new Database(":memory:");
  createPromptsTable(db);
  return db;
}

function jsonRequest(method: string, body: unknown): Request {
  return new Request("http://localhost/api/prompts", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("prompt handlers", () => {
  test("create then list", async () => {
    const db = createTestDatabase();
    const created = await handleCreatePrompt(db, jsonRequest("POST", { title: "A", content: "<a/>" }));
    expect(created.status).toBe(201);

    const listed = await handleListPrompts(db).json();
    expect(listed).toHaveLength(1);
    expect(listed[0].title).toBe("A");
  });

  test("create falls back to defaults on a malformed body", async () => {
    const db = createTestDatabase();
    const request = new Request("http://localhost/api/prompts", { method: "POST", body: "not json" });
    const prompt = await (await handleCreatePrompt(db, request)).json();
    expect(prompt.title).toBe("Untitled");
    expect(prompt.content).toBe("");
  });

  test("update keeps omitted fields", async () => {
    const db = createTestDatabase();
    const prompt = await (await handleCreatePrompt(db, jsonRequest("POST", { title: "A", content: "x" }))).json();
    const updated = await (await handleUpdatePrompt(db, jsonRequest("PUT", { title: "B" }), prompt.id)).json();
    expect(updated.title).toBe("B");
    expect(updated.content).toBe("x");
  });

  test("update and delete of unknown id return 404", async () => {
    const db = createTestDatabase();
    expect((await handleUpdatePrompt(db, jsonRequest("PUT", {}), 99)).status).toBe(404);
    expect(handleDeletePrompt(db, 99).status).toBe(404);
  });

  test("delete removes the prompt", async () => {
    const db = createTestDatabase();
    const prompt = await (await handleCreatePrompt(db, jsonRequest("POST", {}))).json();
    expect(handleDeletePrompt(db, prompt.id).status).toBe(200);
    expect(await handleListPrompts(db).json()).toHaveLength(0);
  });
});
