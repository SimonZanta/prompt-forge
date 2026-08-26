import type { Database } from "bun:sqlite";
import { DEFAULT_TAG_NAMES } from "./tag-defaults.ts";

/** A permanent tag: always suggested by the editor's autocomplete. */
export interface Tag {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

/** Creates the `tags` table if it does not exist yet. */
export function createTagsTable(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

/** Inserts the default tag set when the table is empty. */
export function seedDefaultTags(db: Database): void {
  const { count } = db.query("SELECT COUNT(*) AS count FROM tags").get() as { count: number };
  if (count !== 0) return;
  const insert = db.query("INSERT OR IGNORE INTO tags (name) VALUES (?)");
  for (const name of DEFAULT_TAG_NAMES) insert.run(name);
}

/** All tags sorted by name. */
export function listTags(db: Database): Tag[] {
  return db.query("SELECT * FROM tags ORDER BY name ASC").all() as Tag[];
}

export function findTagById(db: Database, tagId: number): Tag | null {
  return (db.query("SELECT * FROM tags WHERE id = ?").get(tagId) as Tag | null) ?? null;
}

/** True when another tag (not `excludeTagId`) already has this name. */
export function isTagNameTaken(db: Database, name: string, excludeTagId: number | null = null): boolean {
  const row =
    excludeTagId === null
      ? db.query("SELECT id FROM tags WHERE name = ?").get(name)
      : db.query("SELECT id FROM tags WHERE name = ? AND id != ?").get(name, excludeTagId);
  return row !== null;
}

export function insertTag(db: Database, name: string): Tag {
  return db.query("INSERT INTO tags (name) VALUES (?) RETURNING *").get(name) as Tag;
}

export function updateTag(db: Database, tagId: number, name: string): Tag {
  return db
    .query("UPDATE tags SET name = ?, updated_at = datetime('now') WHERE id = ? RETURNING *")
    .get(name, tagId) as Tag;
}

export function deleteTag(db: Database, tagId: number): void {
  db.run("DELETE FROM tags WHERE id = ?", [tagId]);
}
