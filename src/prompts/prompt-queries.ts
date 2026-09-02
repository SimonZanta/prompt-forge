import type { Database } from "bun:sqlite";

/** Row shape of the legacy `prompts` table (prompts used to live in SQLite). */
export interface LegacyPromptRow {
  title: string;
  content: string;
}

/**
 * Creates the legacy `prompts` table if it does not exist yet.
 * Kept only so old databases can be migrated to the `prompts/` folder.
 */
export function createPromptsTable(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS prompts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL DEFAULT 'Untitled',
      content TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

/** All legacy prompts, oldest first, for the one-time migration to `prompts/`. */
export function readLegacyPrompts(db: Database): LegacyPromptRow[] {
  try {
    return db.query("SELECT title, content FROM prompts ORDER BY updated_at ASC").all() as LegacyPromptRow[];
  } catch {
    return [];
  }
}
