import type { Database } from "bun:sqlite";
import { errorResponse, jsonResponse, readJsonBody } from "../http/index.ts";
import { deletePrompt, findPromptById, insertPrompt, listPrompts, updatePrompt } from "./prompt-queries.ts";

/** GET /api/prompts */
export function handleListPrompts(db: Database): Response {
  return jsonResponse(listPrompts(db));
}

/** POST /api/prompts — body: `{ title?, content? }` */
export async function handleCreatePrompt(db: Database, request: Request): Promise<Response> {
  const body = await readJsonBody(request);
  const title = typeof body.title === "string" ? body.title : "Untitled";
  const content = typeof body.content === "string" ? body.content : "";
  return jsonResponse(insertPrompt(db, title, content), 201);
}

/** PUT /api/prompts/:id — body: `{ title?, content? }`; omitted fields keep their current value. */
export async function handleUpdatePrompt(db: Database, request: Request, promptId: number): Promise<Response> {
  const existing = findPromptById(db, promptId);
  if (!existing) return errorResponse("not found", 404);

  const body = await readJsonBody(request);
  const title = typeof body.title === "string" ? body.title : existing.title;
  const content = typeof body.content === "string" ? body.content : existing.content;
  return jsonResponse(updatePrompt(db, promptId, title, content));
}

/** DELETE /api/prompts/:id */
export function handleDeletePrompt(db: Database, promptId: number): Response {
  if (!findPromptById(db, promptId)) return errorResponse("not found", 404);
  deletePrompt(db, promptId);
  return jsonResponse({ ok: true });
}
