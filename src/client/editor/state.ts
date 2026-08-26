import type { Prompt } from "../../prompts/index.ts";
import type { Block } from "../../blocks/index.ts";

/** Mutable state shared by the editor modules. */
export const editorState = {
  prompts: [] as Prompt[],
  currentPrompt: null as Prompt | null,
  /** Custom blocks from settings (`<command` expands to content). */
  blocks: [] as Block[],
  /** Tag names always offered by autocomplete. */
  permanentTagNames: [] as string[],
  /** Editor text before the latest input event; used to detect tag renames. */
  previousValue: "",
};
