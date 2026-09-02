import { flushPendingSave } from "./autosave.ts";
import { expandBlockAt, findBlockByCommand } from "./custom-blocks.ts";
import { editorTextarea } from "./elements.ts";
import {
  acceptSelectedSuggestion, closeSuggestions, isSuggestionBoxOpen, moveSuggestionSelection,
} from "./suggestions.ts";
import { indentSelectedLines, insertTextAtCursor, setCursorPosition, wrapSelectionWith } from "./text-editing.ts";
import { collectOpenTagStack, isInsideCodeContext } from "./xml-context.ts";

/** Keys that wrap the current selection instead of replacing it. */
const WRAP_PAIRS: Record<string, string> = {
  '"': '"', "'": "'", "(": ")", "[": "]", "{": "}", "`": "`", "*": "*", _: "_",
};

/** `>` after `<tag`: inserts `></tag>` with the cursor between, or expands a custom block of that name. */
function autoCloseTagOnGreaterThan(event: KeyboardEvent): void {
  const cursor = editorTextarea.selectionStart;
  if (cursor !== editorTextarea.selectionEnd) return;
  const textBefore = editorTextarea.value.slice(0, cursor);
  if (isInsideCodeContext(textBefore)) return;

  const openTag = textBefore.match(/<([A-Za-z_][\w.:-]*)((?:\s[^<>]*)?)$/);
  if (!openTag || /\/\s*$/.test(openTag[2])) return;
  const [typedTag, tagName, attributes] = openTag;
  event.preventDefault();

  const block = !attributes ? findBlockByCommand(tagName) : null;
  if (block) {
    expandBlockAt(cursor - typedTag.length, cursor, block);
    closeSuggestions();
    return;
  }
  insertTextAtCursor("></" + tagName + ">");
  setCursorPosition(cursor + 1);
  closeSuggestions();
}

/** `/` right after `<`: completes the innermost open tag; on its own line it is dedented one level. */
function completeClosingTagOnSlash(event: KeyboardEvent): void {
  const cursor = editorTextarea.selectionStart;
  if (cursor !== editorTextarea.selectionEnd) return;
  const textBefore = editorTextarea.value.slice(0, cursor);
  if (!textBefore.endsWith("<")) return;
  if (isInsideCodeContext(textBefore)) return;

  const openTags = collectOpenTagStack(textBefore.slice(0, -1));
  if (!openTags.length) return;
  event.preventDefault();
  const tagName = openTags[openTags.length - 1];

  const lineWithOnlyBracket = textBefore.match(/(?:^|\n)([ \t]*)<$/);
  if (lineWithOnlyBracket && lineWithOnlyBracket[1].length >= 2) {
    // replace "  <" (two indent spaces + bracket) with the closing tag
    editorTextarea.setSelectionRange(cursor - 3, cursor);
    insertTextAtCursor("</" + tagName + ">");
  } else {
    insertTextAtCursor("/" + tagName + ">");
  }
  closeSuggestions();
}

/** Enter keeps the current indentation, goes one level deeper after an opening tag, and expands `<a>|</a>`. */
function insertIndentedNewline(event: KeyboardEvent): void {
  const cursor = editorTextarea.selectionStart;
  const textBefore = editorTextarea.value.slice(0, cursor);
  const textAfter = editorTextarea.value.slice(editorTextarea.selectionEnd);
  const currentLine = textBefore.slice(textBefore.lastIndexOf("\n") + 1);
  const indent = (currentLine.match(/^[ \t]*/) || [""])[0];
  const endsWithOpeningTag =
    /<[A-Za-z_][\w.:-]*(?:\s[^<>]*)?>$/.test(textBefore) && !/\/>$/.test(textBefore) && !isInsideCodeContext(textBefore);
  event.preventDefault();

  if (endsWithOpeningTag && /^<\//.test(textAfter)) {
    insertTextAtCursor("\n" + indent + "  \n" + indent);
    setCursorPosition(cursor + 1 + indent.length + 2);
  } else if (endsWithOpeningTag) {
    insertTextAtCursor("\n" + indent + "  ");
  } else {
    insertTextAtCursor("\n" + indent);
  }
}

function handleEditorKeydown(event: KeyboardEvent): void {
  if (isSuggestionBoxOpen()) {
    if (event.key === "ArrowDown") { event.preventDefault(); moveSuggestionSelection(1); return; }
    if (event.key === "ArrowUp") { event.preventDefault(); moveSuggestionSelection(-1); return; }
    if (event.key === "Enter" || event.key === "Tab") { event.preventDefault(); acceptSelectedSuggestion(); return; }
    if (event.key === "Escape") { event.preventDefault(); closeSuggestions(); return; }
  }

  if ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey) {
    const key = event.key.toLowerCase();
    if (key === "b") { event.preventDefault(); wrapSelectionWith("**", "**"); return; }
    if (key === "i") { event.preventDefault(); wrapSelectionWith("*", "*"); return; }
    if (key === "e") { event.preventDefault(); wrapSelectionWith("`", "`"); return; }
    if (key === "s") { event.preventDefault(); flushPendingSave(); return; }
    return;
  }

  const hasSelection = editorTextarea.selectionStart !== editorTextarea.selectionEnd;
  if (hasSelection && WRAP_PAIRS[event.key] && !event.altKey) {
    event.preventDefault();
    wrapSelectionWith(event.key, WRAP_PAIRS[event.key]);
    return;
  }
  if (event.key === "Tab") {
    event.preventDefault();
    if (event.shiftKey || hasSelection) indentSelectedLines(event.shiftKey);
    else insertTextAtCursor("  ");
    return;
  }
  if (event.shiftKey) {
    if (event.key === ">") autoCloseTagOnGreaterThan(event);
    return; // Shift+Enter is a plain newline
  }
  if (event.key === ">") return autoCloseTagOnGreaterThan(event);
  if (event.key === "/") return completeClosingTagOnSlash(event);
  if (event.key === "Enter") return insertIndentedNewline(event);
}

export function bindEditorKeydown(): void {
  editorTextarea.addEventListener("keydown", handleEditorKeydown);
}
