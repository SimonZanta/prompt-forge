import { Database } from "bun:sqlite";
import { createBlocksTable, seedExampleBlock } from "../blocks/index.ts";
import { createPromptsTable } from "../prompts/index.ts";
import { createTagsTable, seedDefaultTags } from "../tags/index.ts";

/**
 * Opens (or creates) the SQLite file, makes sure every table exists and seeds an empty database with defaults.
 * The legacy `prompts` table is still created so old databases can be migrated to the `prompts/` folder;
 * prompt content itself now lives on disk (see `prompts/prompt-store.ts`).
 */
export function openDatabase(filePath: string): Database {
  const db = new Database(filePath);
  createPromptsTable(db);
  createBlocksTable(db);
  createTagsTable(db);
  seedExampleBlock(db);
  seedDefaultTags(db);
  return db;
}
