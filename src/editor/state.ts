import type { Folder, PromptListItem } from "../storage/prompt-store.ts";
import type { Block } from "../storage/settings-store.ts";
import type { PromptTree } from "./node-tree.ts";

export type EditorView = "blocks" | "xml";

/** The prompt file open in the editor. `content` is the XML string that is saved; `tree` is its block form. */
export interface OpenPrompt {
  /** Folder path, e.g. `default/archive`. */
  folder: string;
  name: string;
  content: string;
  /** Last successfully parsed tree; null only when the file never parsed (then the XML view is the only view). */
  tree: PromptTree | null;
  /** False while the XML textarea holds text that does not parse; `tree` is then stale but kept. */
  xmlValid: boolean;
}

/** Mutable state shared by the editor modules. */
export const editorState = {
  /** Every folder of the active store, at every depth. */
  folders: [] as Folder[],
  /** Prompts of every folder, keyed by folder path. */
  promptsByFolder: {} as Record<string, PromptListItem[]>,
  /** Folder paths currently expanded in the rail. */
  expandedFolders: new Set<string>(),
  /** Folder path whose row shows an inline rename field, if any. */
  renamingFolder: null as string | null,
  /** Prompt whose row shows an inline rename field, if any. */
  renamingPrompt: null as { folder: string; name: string } | null,
  /** Current rail search text. */
  searchQuery: "",
  currentPrompt: null as OpenPrompt | null,
  view: "blocks" as EditorView,
  /** Custom blocks from settings (`<command` expands to content in the XML view). */
  blocks: [] as Block[],
  /** Tag names always offered by autocomplete. */
  permanentTagNames: [] as string[],
  /** Editor text before the latest input event; used to detect tag renames. */
  previousValue: "",
};
