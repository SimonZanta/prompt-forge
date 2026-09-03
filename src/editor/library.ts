import { promptStore, storageStatus } from "../storage/active-prompt-store.ts";
import { isWithin, pathSegments, type Folder, type PromptListItem } from "../storage/prompt-store.ts";
import { editorState } from "./state.ts";

/** The folder tree and prompt lists held in memory, plus the pure queries the rail renders from. */

/** Reloads every folder and every prompt list from the active store (empty while a remembered folder is still locked). */
export async function refreshLibrary(): Promise<void> {
  if (storageStatus().mode === "folder-locked") {
    editorState.folders = [];
    editorState.promptsByFolder = {};
    return;
  }
  const store = promptStore();
  const folders = await store.listFolders();
  const lists = await Promise.all(folders.map((folder) => store.listPrompts(folder.path)));
  editorState.folders = folders;
  editorState.promptsByFolder = Object.fromEntries(folders.map((folder, index) => [folder.path, lists[index]]));
}

export function folderAt(path: string): Folder | undefined {
  return editorState.folders.find((folder) => folder.path === path);
}

/** Direct subfolders of `parent` (top level when null), sorted by name. */
export function childFolders(parent: string | null): Folder[] {
  const depth = parent === null ? 1 : pathSegments(parent).length + 1;
  return editorState.folders
    .filter((folder) => pathSegments(folder.path).length === depth && (parent === null || isWithin(folder.path, parent)))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function promptsIn(path: string): PromptListItem[] {
  return editorState.promptsByFolder[path] ?? [];
}

/** Prompts in `path` and every folder below it. */
export function countPromptsBelow(path: string): number {
  return editorState.folders
    .filter((folder) => isWithin(folder.path, path))
    .reduce((sum, folder) => sum + promptsIn(folder.path).length, 0);
}

/** Truly empty — no prompts anywhere below and no subfolders — so deleting it can orphan nothing. */
export function isFolderEmpty(path: string): boolean {
  return countPromptsBelow(path) === 0 && !editorState.folders.some((folder) => folder.path !== path && isWithin(folder.path, path));
}

/** First name in the series `base`, `base 2`, `base 3`, … not in `taken`. */
export function uniqueName(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  if (!used.has(base)) return base;
  let counter = 2;
  while (used.has(`${base} ${counter}`)) counter++;
  return `${base} ${counter}`;
}

/** Expands every folder on the way to (and including) `path`. */
export function expandPathTo(path: string): void {
  const segments = pathSegments(path);
  for (let depth = 1; depth <= segments.length; depth++) editorState.expandedFolders.add(segments.slice(0, depth).join("/"));
}

/** Re-keys expanded-folder state after a folder moved from `oldPath` to `newPath`. */
export function rekeyExpanded(oldPath: string, newPath: string): void {
  const next = new Set<string>();
  for (const path of editorState.expandedFolders) next.add(isWithin(path, oldPath) ? newPath + path.slice(oldPath.length) : path);
  editorState.expandedFolders = next;
}
