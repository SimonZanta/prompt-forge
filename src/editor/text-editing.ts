import { editorTextarea } from "./elements.ts";

/** Inserts `text` at the current selection, preferring `execCommand` so the browser's undo history is kept. */
export function insertTextAtCursor(text: string): void {
  editorTextarea.focus();
  let inserted = false;
  try { inserted = document.execCommand("insertText", false, text); } catch { /* unsupported */ }
  if (!inserted) {
    editorTextarea.setRangeText(text, editorTextarea.selectionStart, editorTextarea.selectionEnd, "end");
    editorTextarea.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

export function setCursorPosition(position: number): void {
  editorTextarea.selectionStart = editorTextarea.selectionEnd = position;
}

/** Indents (or dedents by up to two spaces) every line touched by the selection. */
export function indentSelectedLines(shouldDedent: boolean): void {
  const value = editorTextarea.value;
  const selectionStart = editorTextarea.selectionStart;
  const selectionEnd = editorTextarea.selectionEnd;
  const firstLineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
  let lastLineEnd = value.indexOf("\n", selectionEnd);
  if (lastLineEnd === -1) lastLineEnd = value.length;

  const reindented = value
    .slice(firstLineStart, lastLineEnd)
    .split("\n")
    .map((line) => (shouldDedent ? line.replace(/^ {1,2}/, "") : "  " + line))
    .join("\n");

  editorTextarea.setSelectionRange(firstLineStart, lastLineEnd);
  insertTextAtCursor(reindented);
  editorTextarea.selectionStart = firstLineStart;
  editorTextarea.selectionEnd = firstLineStart + reindented.length;
}

/** Surrounds the selection with `opening`/`closing` and keeps the original text selected. */
export function wrapSelectionWith(opening: string, closing: string): void {
  const selectionStart = editorTextarea.selectionStart;
  const selectedText = editorTextarea.value.slice(selectionStart, editorTextarea.selectionEnd);
  insertTextAtCursor(opening + selectedText + closing);
  if (!selectedText) {
    setCursorPosition(selectionStart + opening.length);
  } else {
    editorTextarea.selectionStart = selectionStart + opening.length;
    editorTextarea.selectionEnd = selectionStart + opening.length + selectedText.length;
  }
}
