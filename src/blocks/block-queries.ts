import type { Database } from "bun:sqlite";
import { EXAMPLE_BLOCK_COMMAND, EXAMPLE_BLOCK_CONTENT } from "./block-defaults.ts";

/** A custom block: typing `<command` in the editor expands to `content`. */
export interface Block {
  id: number;
  command: string;
  content: string;
  created_at: string;
  updated_at: string;
}

/** Creates the `blocks` table if it does not exist yet. */
export function createBlocksTable(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS blocks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      command TEXT NOT NULL UNIQUE,
      content TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

/** Inserts the example block when the table is empty. */
export function seedExampleBlock(db: Database): void {
  const { count } = db.query("SELECT COUNT(*) AS count FROM blocks").get() as { count: number };
  if (count === 0) insertBlock(db, EXAMPLE_BLOCK_COMMAND, EXAMPLE_BLOCK_CONTENT);
}

/** All blocks sorted by command name. */
export function listBlocks(db: Database): Block[] {
  return db.query("SELECT * FROM blocks ORDER BY command ASC").all() as Block[];
}

export function findBlockById(db: Database, blockId: number): Block | null {
  return (db.query("SELECT * FROM blocks WHERE id = ?").get(blockId) as Block | null) ?? null;
}

/** True when another block (not `excludeBlockId`) already uses this command. */
export function isBlockCommandTaken(db: Database, command: string, excludeBlockId: number | null = null): boolean {
  const row =
    excludeBlockId === null
      ? db.query("SELECT id FROM blocks WHERE command = ?").get(command)
      : db.query("SELECT id FROM blocks WHERE command = ? AND id != ?").get(command, excludeBlockId);
  return row !== null;
}

export function insertBlock(db: Database, command: string, content: string): Block {
  return db
    .query("INSERT INTO blocks (command, content) VALUES (?, ?) RETURNING *")
    .get(command, content) as Block;
}

export function updateBlock(db: Database, blockId: number, command: string, content: string): Block {
  return db
    .query("UPDATE blocks SET command = ?, content = ?, updated_at = datetime('now') WHERE id = ? RETURNING *")
    .get(command, content, blockId) as Block;
}

export function deleteBlock(db: Database, blockId: number): void {
  db.run("DELETE FROM blocks WHERE id = ?", [blockId]);
}
