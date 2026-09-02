import type { Database } from "bun:sqlite";
import type { BunRequest } from "bun";
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

export { createPromptsTable } from "./prompt-queries.ts";
export { migrateLegacyPrompts } from "./prompt-store.ts";
export type { Folder, Prompt, PromptListItem } from "./prompt-store.ts";

type FolderRequest = BunRequest<"/api/folders/:folder">;
type PromptsRequest = BunRequest<"/api/folders/:folder/prompts">;
type PromptRequest = BunRequest<"/api/folders/:folder/prompts/:name">;

/** Route table for `Bun.serve({ routes })` covering the folder and prompt-file endpoints. */
export function createPromptRoutes(promptsDir: string) {
  return {
    "/api/folders": {
      GET: () => handleListFolders(promptsDir),
      POST: (request: Request) => handleCreateFolder(promptsDir, request),
    },
    "/api/folders/:folder": {
      PUT: (request: FolderRequest) => handleRenameFolder(promptsDir, request, request.params.folder),
      DELETE: (request: FolderRequest) => handleDeleteFolder(promptsDir, request.params.folder),
    },
    "/api/folders/:folder/prompts": {
      GET: (request: PromptsRequest) => handleListPrompts(promptsDir, request.params.folder),
      POST: (request: PromptsRequest) => handleCreatePrompt(promptsDir, request, request.params.folder),
    },
    "/api/folders/:folder/prompts/:name": {
      GET: (request: PromptRequest) => handleGetPrompt(promptsDir, request.params.folder, request.params.name),
      PUT: (request: PromptRequest) =>
        handleUpdatePrompt(promptsDir, request, request.params.folder, request.params.name),
      DELETE: (request: PromptRequest) =>
        handleDeletePrompt(promptsDir, request.params.folder, request.params.name),
    },
  };
}
