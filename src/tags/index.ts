import type { Database } from "bun:sqlite";
import type { BunRequest } from "bun";
import { handleCreateTag, handleDeleteTag, handleListTags, handleUpdateTag } from "./tag-handlers.ts";

export { createTagsTable, seedDefaultTags } from "./tag-queries.ts";
export type { Tag } from "./tag-queries.ts";
export { TAG_NAME_PATTERN, isValidTagName } from "./tag-validation.ts";

/** Route table for `Bun.serve({ routes })` covering the permanent-tag endpoints. */
export function createTagRoutes(db: Database) {
  return {
    "/api/tags": {
      GET: () => handleListTags(db),
      POST: (request: Request) => handleCreateTag(db, request),
    },
    "/api/tags/:id": {
      PUT: (request: BunRequest<"/api/tags/:id">) => handleUpdateTag(db, request, Number(request.params.id)),
      DELETE: (request: BunRequest<"/api/tags/:id">) => handleDeleteTag(db, Number(request.params.id)),
    },
  };
}
