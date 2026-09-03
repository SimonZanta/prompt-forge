import { EXAMPLE_BLOCK_COMMAND, EXAMPLE_BLOCK_CONTENT } from "./block-defaults.ts";
import { isValidBlockCommand } from "./block-validation.ts";
import { DEFAULT_TAG_NAMES } from "./tag-defaults.ts";
import { isValidTagName } from "./tag-validation.ts";

/** Settings (custom blocks, permanent tags) live as one JSON document in localStorage. */

/** A custom block: typing `<command` in the editor expands to `content`. */
export interface Block {
  command: string;
  content: string;
}

export interface Settings {
  version: 1;
  blocks: Block[];
  /** Tag names always offered by the editor's autocomplete. */
  tags: string[];
}

export const SETTINGS_KEY = "settings";

export function defaultSettings(): Settings {
  return {
    version: 1,
    blocks: [{ command: EXAMPLE_BLOCK_COMMAND, content: EXAMPLE_BLOCK_CONTENT }],
    tags: [...DEFAULT_TAG_NAMES],
  };
}

/** Accepts only well-formed entries so a hand-edited or corrupted document cannot break the editor. */
export function parseSettings(json: string | null): Settings | null {
  if (!json) return null;
  try {
    const raw = JSON.parse(json) as Partial<Settings>;
    if (!raw || typeof raw !== "object") return null;
    const blocks = Array.isArray(raw.blocks)
      ? raw.blocks.filter((block): block is Block =>
          !!block && typeof block.command === "string" && isValidBlockCommand(block.command) && typeof block.content === "string")
      : [];
    const tags = Array.isArray(raw.tags)
      ? raw.tags.filter((tag): tag is string => typeof tag === "string" && isValidTagName(tag))
      : [];
    return { version: 1, blocks, tags: [...new Set(tags)] };
  } catch {
    return null;
  }
}

/** Reads settings; a first visit gets (and persists) the defaults. */
export function loadSettings(): Settings {
  let stored: string | null = null;
  try { stored = localStorage.getItem(SETTINGS_KEY); } catch { /* storage may be unavailable */ }
  const parsed = parseSettings(stored);
  if (parsed) return parsed;
  const defaults = defaultSettings();
  writeSettings(defaults);
  return defaults;
}

function writeSettings(settings: Settings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings, null, 2));
}

/** Merges `patch` into the stored settings (so the blocks and tags sections never overwrite each other). */
export function saveSettings(patch: Partial<Pick<Settings, "blocks" | "tags">>): Settings {
  const next: Settings = { ...loadSettings(), ...patch, version: 1 };
  writeSettings(next);
  return next;
}
