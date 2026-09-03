import type { Folder, PromptListItem } from "../storage/prompt-store.ts";
import type { Block } from "../storage/settings-store.ts";

/** The prompt file open in the editor. */
export interface OpenPrompt {
  folder: string;
  name: string;
  content: string;
}

/** Mutable state shared by the editor modules. */
export const editorState = {
  folders: [] as Folder[],
  /** Folder whose prompts fill the sidebar list; `null` while no folder has been opened. */
  currentFolder: null as string | null,
  prompts: [] as PromptListItem[],
  currentPrompt: null as OpenPrompt | null,
  /** Custom blocks from settings (`<command` expands to content). */
  blocks: [] as Block[],
  /** Tag names always offered by autocomplete. */
  permanentTagNames: [] as string[],
  /** Editor text before the latest input event; used to detect tag renames. */
  previousValue: "",
};
