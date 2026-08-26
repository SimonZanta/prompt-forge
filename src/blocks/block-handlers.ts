import type { Database } from "bun:sqlite";
import { errorResponse, jsonResponse, readJsonBody } from "../http/index.ts";
import { deleteBlock, findBlockById, insertBlock, isBlockCommandTaken, listBlocks, updateBlock } from "./block-queries.ts";
import { isValidBlockCommand } from "./block-validation.ts";

/** GET /api/blocks */
export function handleListBlocks(db: Database): Response {
  return jsonResponse(listBlocks(db));
}

/** POST /api/blocks — body: `{ command, content? }`; 400 on invalid command, 409 on duplicate. */
export async function handleCreateBlock(db: Database, request: Request): Promise<Response> {
  const body = await readJsonBody(request);
  const command = String(body.command ?? "");
  if (!isValidBlockCommand(command)) return errorResponse("invalid command", 400);
  if (isBlockCommandTaken(db, command)) return errorResponse("duplicate command", 409);

  const content = typeof body.content === "string" ? body.content : "";
  return jsonResponse(insertBlock(db, command, content), 201);
}

/** PUT /api/blocks/:id — body: `{ command?, content? }`; omitted fields keep their current value. */
export async function handleUpdateBlock(db: Database, request: Request, blockId: number): Promise<Response> {
  const existing = findBlockById(db, blockId);
  if (!existing) return errorResponse("not found", 404);

  const body = await readJsonBody(request);
  const command = body.command === undefined ? existing.command : String(body.command);
  if (!isValidBlockCommand(command)) return errorResponse("invalid command", 400);
  if (isBlockCommandTaken(db, command, blockId)) return errorResponse("duplicate command", 409);

  const content = body.content === undefined ? existing.content : String(body.content);
  return jsonResponse(updateBlock(db, blockId, command, content));
}

/** DELETE /api/blocks/:id */
export function handleDeleteBlock(db: Database, blockId: number): Response {
  if (!findBlockById(db, blockId)) return errorResponse("not found", 404);
  deleteBlock(db, blockId);
  return jsonResponse({ ok: true });
}
