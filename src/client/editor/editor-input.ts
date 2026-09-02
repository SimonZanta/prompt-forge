import { scheduleSave } from "./autosave.ts";
import { scheduleCommandCheck } from "./command-extraction.ts";
import { editorTextarea } from "./elements.ts";
import { refreshHighlight, syncHighlightScroll } from "./highlight-layer.ts";
import { computeLineFill } from "./line-fill.ts";
import { editorState } from "./state.ts";
import { updateSuggestions } from "./suggestions.ts";
import { computePartnerRename } from "./tag-rename-sync.ts";
import { insertTextAtCursor } from "./text-editing.ts";

/** Guards against re-entering the fill logic from the input event our own insertion triggers. */
let isFillingLine = false;

/** After typing one character, wraps the line at `FILL_COLUMN` when it grew too long. */
function wrapLineIfTooLong(event: InputEvent): void {
  if (isFillingLine || event.inputType !== "insertText" || !event.data || event.data.length !== 1) return;
  const fill = computeLineFill(editorTextarea.value, editorTextarea.selectionStart);
  if (!fill) return;
  isFillingLine = true;
  // replace the break space with newline + indentation
  editorTextarea.setSelectionRange(fill.breakIndex, fill.breakIndex + 1);
  insertTextAtCursor("\n" + fill.indent);
  editorTextarea.setSelectionRange(fill.newCursor, fill.newCursor);
  isFillingLine = false;
}

/** When a tag name was edited, renames its partner tag too, keeping the selection where it was. */
function syncPartnerTagName(): void {
  const rename = computePartnerRename(editorState.previousValue, editorTextarea.value);
  if (rename) {
    const selectionStart = editorTextarea.selectionStart;
    const selectionEnd = editorTextarea.selectionEnd;
    const lengthShift = rename.name.length - (rename.end - rename.start);
    editorTextarea.setRangeText(rename.name, rename.start, rename.end, "preserve");
    if (rename.start < selectionStart) editorTextarea.setSelectionRange(selectionStart + lengthShift, selectionEnd + lengthShift);
    else editorTextarea.setSelectionRange(selectionStart, selectionEnd);
  }
  editorState.previousValue = editorTextarea.value;
}

function handleEditorInput(event: Event): void {
  wrapLineIfTooLong(event as InputEvent);
  syncPartnerTagName();
  refreshHighlight();
  syncHighlightScroll();
  scheduleSave();
  updateSuggestions();
  scheduleCommandCheck();
}

export function bindEditorInput(): void {
  editorTextarea.addEventListener("input", handleEditorInput);
  editorTextarea.addEventListener("scroll", syncHighlightScroll);
}
