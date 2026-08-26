import { Database } from "bun:sqlite";
import { createBlocksTable, seedExampleBlock } from "../blocks/index.ts";
import { createPromptsTable, seedExamplePrompt } from "../prompts/index.ts";
import { createTagsTable, seedDefaultTags } from "../tags/index.ts";

/** Opens (or creates) the SQLite file, makes sure every table exists and seeds an empty database with defaults. */
export function openDatabase(filePath: string): Database {
  const db = new Database(filePath);
  createPromptsTable(db);
  createBlocksTable(db);
  createTagsTable(db);
  seedExamplePrompt(db);
  seedExampleBlock(db);
  seedDefaultTags(db);
  return db;
}
