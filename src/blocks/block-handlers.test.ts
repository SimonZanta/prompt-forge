import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { createBlocksTable } from "./block-queries.ts";
import { handleCreateBlock, handleDeleteBlock, handleListBlocks, handleUpdateBlock } from "./block-handlers.ts";

function createTestDatabase(): Database {
  const db = new Database(":memory:");
  createBlocksTable(db);
  return db;
}

function jsonRequest(method: string, body: unknown): Request {
  return new Request("http://localhost/api/blocks", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("block handlers", () => {
  test("creates a block and lists it", async () => {
    const db = createTestDatabase();
    const response = await handleCreateBlock(db, jsonRequest("POST", { command: "task", content: "<task/>" }));
    expect(response.status).toBe(201);
    expect(await handleListBlocks(db).json()).toHaveLength(1);
  });

  test("rejects invalid and duplicate commands", async () => {
    const db = createTestDatabase();
    expect((await handleCreateBlock(db, jsonRequest("POST", { command: "1bad" }))).status).toBe(400);
    expect((await handleCreateBlock(db, jsonRequest("POST", { command: "has space" }))).status).toBe(400);
    await handleCreateBlock(db, jsonRequest("POST", { command: "dup" }));
    expect((await handleCreateBlock(db, jsonRequest("POST", { command: "dup" }))).status).toBe(409);
  });

  test("update validates the command against other blocks only", async () => {
    const db = createTestDatabase();
    const first = await (await handleCreateBlock(db, jsonRequest("POST", { command: "one" }))).json();
    await handleCreateBlock(db, jsonRequest("POST", { command: "two" }));

    // renaming to itself is fine, renaming onto another block is a conflict
    expect((await handleUpdateBlock(db, jsonRequest("PUT", { command: "one", content: "x" }), first.id)).status).toBe(200);
    expect((await handleUpdateBlock(db, jsonRequest("PUT", { command: "two" }), first.id)).status).toBe(409);
    expect((await handleUpdateBlock(db, jsonRequest("PUT", {}), 99)).status).toBe(404);
  });

  test("delete removes the block", async () => {
    const db = createTestDatabase();
    const block = await (await handleCreateBlock(db, jsonRequest("POST", { command: "gone" }))).json();
    expect(handleDeleteBlock(db, block.id).status).toBe(200);
    expect(handleDeleteBlock(db, block.id).status).toBe(404);
  });
});
