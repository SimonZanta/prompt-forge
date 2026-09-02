import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { createTagsTable } from "./tag-queries.ts";
import { handleCreateTag, handleDeleteTag, handleListTags, handleUpdateTag } from "./tag-handlers.ts";

function createTestDatabase(): Database {
  const db = new Database(":memory:");
  createTagsTable(db);
  return db;
}

function jsonRequest(method: string, body: unknown): Request {
  return new Request("http://localhost/api/tags", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("tag handlers", () => {
  test("creates a tag and lists it sorted", async () => {
    const db = createTestDatabase();
    await handleCreateTag(db, jsonRequest("POST", { name: "zeta" }));
    await handleCreateTag(db, jsonRequest("POST", { name: "alpha" }));
    const tags = await handleListTags(db).json();
    expect(tags.map((tag: { name: string }) => tag.name)).toEqual(["alpha", "zeta"]);
  });

  test("rejects invalid and duplicate names", async () => {
    const db = createTestDatabase();
    expect((await handleCreateTag(db, jsonRequest("POST", { name: "" }))).status).toBe(400);
    expect((await handleCreateTag(db, jsonRequest("POST", { name: "9x" }))).status).toBe(400);
    expect((await handleCreateTag(db, jsonRequest("POST", { name: "ns:tag" }))).status).toBe(201);
    expect((await handleCreateTag(db, jsonRequest("POST", { name: "ns:tag" }))).status).toBe(409);
  });

  test("update renames and detects conflicts", async () => {
    const db = createTestDatabase();
    const tag = await (await handleCreateTag(db, jsonRequest("POST", { name: "a" }))).json();
    await handleCreateTag(db, jsonRequest("POST", { name: "b" }));
    expect((await (await handleUpdateTag(db, jsonRequest("PUT", { name: "c" }), tag.id)).json()).name).toBe("c");
    expect((await handleUpdateTag(db, jsonRequest("PUT", { name: "b" }), tag.id)).status).toBe(409);
    expect((await handleUpdateTag(db, jsonRequest("PUT", { name: "x" }), 99)).status).toBe(404);
  });

  test("delete removes the tag", async () => {
    const db = createTestDatabase();
    const tag = await (await handleCreateTag(db, jsonRequest("POST", { name: "a" }))).json();
    expect(handleDeleteTag(db, tag.id).status).toBe(200);
    expect(await handleListTags(db).json()).toHaveLength(0);
  });
});
