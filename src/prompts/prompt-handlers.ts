import { errorResponse, jsonResponse, readJsonBody } from "../http/index.ts";
import {
  createFolder,
  deleteFolder,
  deletePrompt,
  folderExists,
  isValidName,
  listFolders,
  listPromptsInFolder,
  promptExists,
  readPrompt,
  renameFolder,
  renamePrompt,
  writePrompt,
} from "./prompt-store.ts";

/* ---------- folders ---------- */

/** GET /api/folders */
export function handleListFolders(promptsDir: string): Response {
  return jsonResponse(listFolders(promptsDir));
}

/** POST /api/folders — body: `{ name }` */
export async function handleCreateFolder(promptsDir: string, request: Request): Promise<Response> {
  const body = await readJsonBody(request);
  const name = String(body.name ?? "");
  if (!isValidName(name)) return errorResponse("invalid folder name", 400);
  if (folderExists(promptsDir, name)) return errorResponse("duplicate folder", 409);
  createFolder(promptsDir, name);
  return jsonResponse({ name, prompt_count: 0 }, 201);
}

/** PUT /api/folders/:folder — body: `{ name }` renames the folder. */
export async function handleRenameFolder(promptsDir: string, request: Request, folder: string): Promise<Response> {
  const invalid = checkFolder(promptsDir, folder);
  if (invalid) return invalid;

  const body = await readJsonBody(request);
  const name = String(body.name ?? "");
  if (!isValidName(name)) return errorResponse("invalid folder name", 400);
  if (name !== folder) {
    if (folderExists(promptsDir, name)) return errorResponse("duplicate folder", 409);
    renameFolder(promptsDir, folder, name);
  }
  return jsonResponse({ name });
}

/** DELETE /api/folders/:folder — removes the folder and every prompt in it. */
export function handleDeleteFolder(promptsDir: string, folder: string): Response {
  const invalid = checkFolder(promptsDir, folder);
  if (invalid) return invalid;
  deleteFolder(promptsDir, folder);
  return jsonResponse({ ok: true });
}

/* ---------- prompts (files inside a folder) ---------- */

/** GET /api/folders/:folder/prompts */
export function handleListPrompts(promptsDir: string, folder: string): Response {
  const invalid = checkFolder(promptsDir, folder, "folder not found");
  if (invalid) return invalid;
  return jsonResponse(listPromptsInFolder(promptsDir, folder));
}

/** POST /api/folders/:folder/prompts — body: `{ name, content? }` */
export async function handleCreatePrompt(promptsDir: string, request: Request, folder: string): Promise<Response> {
  const invalid = checkFolder(promptsDir, folder, "folder not found");
  if (invalid) return invalid;

  const body = await readJsonBody(request);
  const name = String(body.name ?? "");
  if (!isValidName(name)) return errorResponse("invalid prompt name", 400);
  if (promptExists(promptsDir, folder, name)) return errorResponse("duplicate prompt", 409);
  const content = String(body.content ?? "");
  writePrompt(promptsDir, folder, name, content);
  return jsonResponse({ name, content }, 201);
}

/** GET /api/folders/:folder/prompts/:name */
export function handleGetPrompt(promptsDir: string, folder: string, name: string): Response {
  const invalid = checkPrompt(promptsDir, folder, name);
  if (invalid) return invalid;
  return jsonResponse(readPrompt(promptsDir, folder, name));
}

/** PUT /api/folders/:folder/prompts/:name — body: `{ name? }` renames, `{ content? }` rewrites. */
export async function handleUpdatePrompt(
  promptsDir: string,
  request: Request,
  folder: string,
  name: string,
): Promise<Response> {
  const invalid = checkPrompt(promptsDir, folder, name);
  if (invalid) return invalid;

  const body = await readJsonBody(request);
  let newName = name;
  if (body.name !== undefined && String(body.name) !== name) {
    newName = String(body.name);
    if (!isValidName(newName)) return errorResponse("invalid prompt name", 400);
    if (promptExists(promptsDir, folder, newName)) return errorResponse("duplicate prompt", 409);
    renamePrompt(promptsDir, folder, name, newName);
  }
  if (body.content !== undefined) {
    writePrompt(promptsDir, folder, newName, String(body.content));
  }
  return jsonResponse(readPrompt(promptsDir, folder, newName));
}

/** DELETE /api/folders/:folder/prompts/:name */
export function handleDeletePrompt(promptsDir: string, folder: string, name: string): Response {
  const invalid = checkPrompt(promptsDir, folder, name);
  if (invalid) return invalid;
  deletePrompt(promptsDir, folder, name);
  return jsonResponse({ ok: true });
}

/* ---------- shared validation ---------- */

/** Returns an error response when `folder` is invalid or missing, `null` when it is usable. */
function checkFolder(promptsDir: string, folder: string, missingMessage = "not found"): Response | null {
  if (!isValidName(folder)) return errorResponse("invalid folder name", 400);
  if (!folderExists(promptsDir, folder)) return errorResponse(missingMessage, 404);
  return null;
}

/** Returns an error response when the folder/prompt pair is invalid or missing, `null` when it is usable. */
function checkPrompt(promptsDir: string, folder: string, name: string): Response | null {
  if (!isValidName(folder) || !isValidName(name)) return errorResponse("invalid name", 400);
  if (!promptExists(promptsDir, folder, name)) return errorResponse("not found", 404);
  return null;
}
