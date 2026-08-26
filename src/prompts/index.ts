import type { Database } from "bun:sqlite";
import type { BunRequest } from "bun";
import { handleCreatePrompt, handleDeletePrompt, handleListPrompts, handleUpdatePrompt } from "./prompt-handlers.ts";

export { createPromptsTable, seedExamplePrompt } from "./prompt-queries.ts";
export type { Prompt } from "./prompt-queries.ts";

/** Route table for `Bun.serve({ routes })` covering the prompt endpoints. */
export function createPromptRoutes(db: Database) {
  return {
    "/api/prompts": {
      GET: () => handleListPrompts(db),
      POST: (request: Request) => handleCreatePrompt(db, request),
    },
    "/api/prompts/:id": {
      PUT: (request: BunRequest<"/api/prompts/:id">) => handleUpdatePrompt(db, request, Number(request.params.id)),
      DELETE: (request: BunRequest<"/api/prompts/:id">) => handleDeletePrompt(db, Number(request.params.id)),
    },
  };
}
