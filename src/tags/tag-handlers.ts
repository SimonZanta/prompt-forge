import type { Database } from "bun:sqlite";
import { errorResponse, jsonResponse, readJsonBody } from "../http/index.ts";
import { deleteTag, findTagById, insertTag, isTagNameTaken, listTags, updateTag } from "./tag-queries.ts";
import { isValidTagName } from "./tag-validation.ts";

/** GET /api/tags */
export function handleListTags(db: Database): Response {
  return jsonResponse(listTags(db));
}

/** POST /api/tags — body: `{ name }`; 400 on invalid name, 409 on duplicate. */
export async function handleCreateTag(db: Database, request: Request): Promise<Response> {
  const body = await readJsonBody(request);
  const name = String(body.name ?? "");
  if (!isValidTagName(name)) return errorResponse("invalid tag", 400);
  if (isTagNameTaken(db, name)) return errorResponse("duplicate tag", 409);
  return jsonResponse(insertTag(db, name), 201);
}

/** PUT /api/tags/:id — body: `{ name? }`; an omitted name keeps the current one. */
export async function handleUpdateTag(db: Database, request: Request, tagId: number): Promise<Response> {
  const existing = findTagById(db, tagId);
  if (!existing) return errorResponse("not found", 404);

  const body = await readJsonBody(request);
  const name = body.name === undefined ? existing.name : String(body.name);
  if (!isValidTagName(name)) return errorResponse("invalid tag", 400);
  if (isTagNameTaken(db, name, tagId)) return errorResponse("duplicate tag", 409);
  return jsonResponse(updateTag(db, tagId, name));
}

/** DELETE /api/tags/:id */
export function handleDeleteTag(db: Database, tagId: number): Response {
  if (!findTagById(db, tagId)) return errorResponse("not found", 404);
  deleteTag(db, tagId);
  return jsonResponse({ ok: true });
}
