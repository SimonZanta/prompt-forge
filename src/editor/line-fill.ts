import { isInsideCodeContext } from "./xml-context.ts";

/** Lines longer than this are wrapped while typing. */
export const FILL_COLUMN = 100;

export interface LineFill {
  /** Absolute index of the space that becomes the line break. */
  breakIndex: number;
  /** Indentation copied onto the continuation line. */
  indent: string;
  newValue: string;
  newCursor: number;
}

/**
 * Decides whether the line ending at `cursor` should be wrapped at `FILL_COLUMN`.
 * Returns `null` when nothing should change: the cursor is not at the line end, the line is short,
 * it is a pure tag line, it is inside code, or there is no space to break at.
 */
export function computeLineFill(value: string, cursor: number): LineFill | null {
  const lineStart = value.lastIndexOf("\n", cursor - 1) + 1;
  let lineEnd = value.indexOf("\n", cursor);
  if (lineEnd === -1) lineEnd = value.length;
  if (cursor !== lineEnd) return null;

  const line = value.slice(lineStart, lineEnd);
  if (line.length <= FILL_COLUMN) return null;
  if (/^[ \t]*<[^\n]*>[ \t]*$/.test(line)) return null;
  if (isInsideCodeContext(value.slice(0, cursor))) return null;

  const indent = (line.match(/^[ \t]*/) || [""])[0];
  let breakInLine = line.lastIndexOf(" ", FILL_COLUMN);
  if (breakInLine <= indent.length) breakInLine = line.lastIndexOf(" ");
  if (breakInLine <= indent.length) return null;

  const breakIndex = lineStart + breakInLine;
  return {
    breakIndex,
    indent,
    newValue: value.slice(0, breakIndex) + "\n" + indent + value.slice(breakIndex + 1),
    newCursor: cursor + indent.length,
  };
}
