import type { Database } from "bun:sqlite";
import { EXAMPLE_PROMPT_CONTENT, EXAMPLE_PROMPT_TITLE } from "./prompt-defaults.ts";

export interface Prompt {
  id: number;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

/** Creates the `prompts` table if it does not exist yet. */
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

/** Inserts the example prompt when the table is empty, so a fresh install is not blank. */
export function seedExamplePrompt(db: Database): void {
  const { count } = db.query("SELECT COUNT(*) AS count FROM prompts").get() as { count: number };
  if (count === 0) insertPrompt(db, EXAMPLE_PROMPT_TITLE, EXAMPLE_PROMPT_CONTENT);
}

/** All prompts, most recently updated first. */
export function listPrompts(db: Database): Prompt[] {
  return db.query("SELECT * FROM prompts ORDER BY updated_at DESC").all() as Prompt[];
}

export function findPromptById(db: Database, promptId: number): Prompt | null {
  return (db.query("SELECT * FROM prompts WHERE id = ?").get(promptId) as Prompt | null) ?? null;
}

export function insertPrompt(db: Database, title: string, content: string): Prompt {
  return db
    .query("INSERT INTO prompts (title, content) VALUES (?, ?) RETURNING *")
    .get(title, content) as Prompt;
}

export function updatePrompt(db: Database, promptId: number, title: string, content: string): Prompt {
  return db
    .query("UPDATE prompts SET title = ?, content = ?, updated_at = datetime('now') WHERE id = ? RETURNING *")
    .get(title, content, promptId) as Prompt;
}

export function deletePrompt(db: Database, promptId: number): void {
  db.run("DELETE FROM prompts WHERE id = ?", [promptId]);
}
