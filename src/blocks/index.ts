import type { Database } from "bun:sqlite";
import type { BunRequest } from "bun";
import { handleCreateBlock, handleDeleteBlock, handleListBlocks, handleUpdateBlock } from "./block-handlers.ts";

export { createBlocksTable, seedExampleBlock } from "./block-queries.ts";
export type { Block } from "./block-queries.ts";
export { BLOCK_COMMAND_PATTERN, isValidBlockCommand } from "./block-validation.ts";

/** Route table for `Bun.serve({ routes })` covering the custom-block endpoints. */
export function createBlockRoutes(db: Database) {
  return {
    "/api/blocks": {
      GET: () => handleListBlocks(db),
      POST: (request: Request) => handleCreateBlock(db, request),
    },
    "/api/blocks/:id": {
      PUT: (request: BunRequest<"/api/blocks/:id">) => handleUpdateBlock(db, request, Number(request.params.id)),
      DELETE: (request: BunRequest<"/api/blocks/:id">) => handleDeleteBlock(db, Number(request.params.id)),
    },
  };
}
