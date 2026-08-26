import type { Block } from "../../blocks/index.ts";
import { apiRequest } from "../shared/api.ts";
import { editorTextarea } from "./elements.ts";
import { editorState } from "./state.ts";
import { insertTextAtCursor, setCursorPosition } from "./text-editing.ts";

/** Fetches the custom blocks; keeps the previous list if the request fails. */
export async function loadBlocks(): Promise<void> {
  try {
    const blocks = await apiRequest<Block[]>("/blocks");
    if (Array.isArray(blocks)) editorState.blocks = blocks;
  } catch { /* keep previous list */ }
}

export function findBlockByCommand(command: string): Block | null {
  return editorState.blocks.find((block) => block.command === command) ?? null;
}

/**
 * Replaces `[start, end)` (the typed `<command` text) with the block content, re-indented to the
 * current line's indentation. The cursor lands in the first empty `><` spot, or after the block.
 */
export function expandBlockAt(start: number, end: number, block: Block): void {
  const value = editorTextarea.value;
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  const indent = (value.slice(lineStart, start).match(/^[ \t]*/) || [""])[0];
  const contentLines = (block.content || "").replace(/\r\n?/g, "\n").replace(/\n+$/, "").split("\n");
  const indentedContent = contentLines.map((line, i) => (i === 0 || !line ? line : indent + line)).join("\n");

  editorTextarea.setSelectionRange(start, end);
  insertTextAtCursor(indentedContent);
  const firstEmptySpot = indentedContent.indexOf("><");
  setCursorPosition(start + (firstEmptySpot >= 0 ? firstEmptySpot + 1 : indentedContent.length));
}
