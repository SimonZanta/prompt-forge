import type { Database } from "bun:sqlite";
import { join } from "path";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { EXAMPLE_PROMPT_CONTENT, EXAMPLE_PROMPT_TITLE } from "./prompt-defaults.ts";
import { readLegacyPrompts } from "./prompt-queries.ts";

/** Prompts live on disk as `prompts/<folder>/<name>.xml`; folder and prompt names are the file names. */

export interface Folder {
  name: string;
  prompt_count: number;
}

/** Sidebar listing entry for one prompt file. */
export interface PromptListItem {
  name: string;
  updated_at: string;
}

/** A prompt file with its content, as returned by the single-prompt endpoints. */
export interface Prompt {
  name: string;
  content: string;
}

// Names become directory / file names, so they must be a single safe path segment.
const NAME_MAX = 100;

export function isValidName(name: string): boolean {
  return (
    typeof name === "string" &&
    name.length > 0 &&
    name.length <= NAME_MAX &&
    !/[/\\<>:"|?*\x00-\x1f]/.test(name) &&
    !name.startsWith(".") &&
    !/[. ]$/.test(name) &&
    name.trim() === name
  );
}

/** Turns an arbitrary legacy title into a valid file name. */
export function sanitizeName(raw: string): string {
  const sanitized = raw
    .replace(/[/\\<>:"|?*\x00-\x1f]/g, "-")
    .replace(/^\.+/, "")
    .replace(/[. ]+$/, "")
    .trim()
    .slice(0, NAME_MAX);
  return sanitized || "Untitled";
}

export const folderPath = (promptsDir: string, folder: string) => join(promptsDir, folder);
export const promptPath = (promptsDir: string, folder: string, name: string) =>
  join(promptsDir, folder, name + ".xml");

/**
 * One-time setup: creates `prompts/` and moves any legacy database prompts into `prompts/default/`.
 * A fresh install (no legacy rows) gets the example prompt instead.
 */
export function migrateLegacyPrompts(db: Database, promptsDir: string): void {
  if (existsSync(promptsDir)) return;
  mkdirSync(folderPath(promptsDir, "default"), { recursive: true });

  let rows = readLegacyPrompts(db);
  if (rows.length === 0) rows = [{ title: EXAMPLE_PROMPT_TITLE, content: EXAMPLE_PROMPT_CONTENT }];

  const usedNames = new Set<string>();
  for (const row of rows) {
    const base = sanitizeName(row.title || "Untitled");
    let name = base;
    let suffix = 2;
    while (usedNames.has(name)) name = `${base} ${suffix++}`;
    usedNames.add(name);
    writeFileSync(promptPath(promptsDir, "default", name), row.content ?? "");
  }
}

/** All folders with their prompt counts, alphabetical. */
export function listFolders(promptsDir: string): Folder[] {
  return readdirSync(promptsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      name: entry.name,
      prompt_count: readdirSync(folderPath(promptsDir, entry.name)).filter((file) => file.endsWith(".xml")).length,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Prompts in one folder, most recently modified first. */
export function listPromptsInFolder(promptsDir: string, folder: string): PromptListItem[] {
  return readdirSync(folderPath(promptsDir, folder))
    .filter((file) => file.endsWith(".xml"))
    .map((file) => {
      const name = file.slice(0, -4);
      return { name, updated_at: statSync(promptPath(promptsDir, folder, name)).mtime.toISOString() };
    })
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export function folderExists(promptsDir: string, folder: string): boolean {
  return existsSync(folderPath(promptsDir, folder));
}

export function createFolder(promptsDir: string, folder: string): void {
  mkdirSync(folderPath(promptsDir, folder));
}

export function renameFolder(promptsDir: string, folder: string, newName: string): void {
  renameSync(folderPath(promptsDir, folder), folderPath(promptsDir, newName));
}

export function deleteFolder(promptsDir: string, folder: string): void {
  rmSync(folderPath(promptsDir, folder), { recursive: true, force: true });
}

export function promptExists(promptsDir: string, folder: string, name: string): boolean {
  return existsSync(promptPath(promptsDir, folder, name));
}

export function readPrompt(promptsDir: string, folder: string, name: string): Prompt {
  return { name, content: readFileSync(promptPath(promptsDir, folder, name), "utf8") };
}

export function writePrompt(promptsDir: string, folder: string, name: string, content: string): void {
  writeFileSync(promptPath(promptsDir, folder, name), content);
}

export function renamePrompt(promptsDir: string, folder: string, name: string, newName: string): void {
  renameSync(promptPath(promptsDir, folder, name), promptPath(promptsDir, folder, newName));
}

export function deletePrompt(promptsDir: string, folder: string, name: string): void {
  rmSync(promptPath(promptsDir, folder, name));
}
