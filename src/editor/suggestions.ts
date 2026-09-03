import type { Block } from "../storage/settings-store.ts";
import { expandBlockAt, findBlockByCommand } from "./custom-blocks.ts";
import { editorTextarea, editorWrap, suggestionBox } from "./elements.ts";
import { editorState } from "./state.ts";
import { escapeHtml, tagColorClass } from "./syntax-highlight.ts";
import { insertTextAtCursor, setCursorPosition } from "./text-editing.ts";
import { isInsideCodeContext } from "./xml-context.ts";

/** Autocomplete popup shown after typing `<`: lists custom blocks first, then tag names. */

interface SuggestionItem {
  name: string;
  /** Present when the item is a custom block rather than a plain tag. */
  block?: Block;
}

const MAX_SUGGESTIONS = 12;

let suggestionItems: SuggestionItem[] = [];
let selectedIndex = 0;
/** The partial tag name typed after `<`. */
let typedPrefix = "";

export function isSuggestionBoxOpen(): boolean {
  return !suggestionBox.hidden;
}

/** Permanent tags plus every tag name already used in the current prompt, sorted. */
export function collectSuggestableTagNames(): string[] {
  const names = new Set(editorState.permanentTagNames);
  const tagPattern = /<([A-Za-z_][\w.:-]*)/g;
  let match: RegExpExecArray | null;
  while ((match = tagPattern.exec(editorTextarea.value))) names.add(match[1]);
  return [...names].sort();
}

/** Recomputes the suggestion list for the text before the cursor and shows or hides the popup. */
export function updateSuggestions(): void {
  const cursor = editorTextarea.selectionStart;
  if (cursor !== editorTextarea.selectionEnd) return closeSuggestions();
  const textBefore = editorTextarea.value.slice(0, cursor);
  const match = textBefore.match(/<([A-Za-z_][\w.:-]*)?$/);
  if (!match) return closeSuggestions();

  typedPrefix = match[1] || "";
  const blockItems: SuggestionItem[] = editorState.blocks
    .filter((block) => block.command.startsWith(typedPrefix))
    .map((block) => ({ name: block.command, block }));
  const tagItems: SuggestionItem[] = collectSuggestableTagNames()
    .filter((name) => name.startsWith(typedPrefix) && name !== typedPrefix && !findBlockByCommand(name))
    .map((name) => ({ name }));

  suggestionItems = [...blockItems, ...tagItems].slice(0, MAX_SUGGESTIONS);
  if (!suggestionItems.length) return closeSuggestions();
  selectedIndex = 0;
  renderSuggestions();
  positionSuggestionBox();
  suggestionBox.hidden = false;
}

function renderSuggestions(): void {
  suggestionBox.innerHTML = "";
  suggestionItems.forEach(({ name, block }, index) => {
    const row = document.createElement("div");
    if (index === selectedIndex) row.classList.add("sel");
    if (block) row.classList.add("block");
    row.innerHTML =
      '<span class="' + (block ? "" : tagColorClass(name)) + '"><b>' + escapeHtml(typedPrefix) + "</b>" +
      escapeHtml(name.slice(typedPrefix.length)) + "</span>" +
      (block ? '<span class="badge">block</span>' : "");
    // mousedown (not click) so the textarea keeps focus
    row.addEventListener("mousedown", (event) => {
      event.preventDefault();
      selectedIndex = index;
      acceptSelectedSuggestion();
    });
    suggestionBox.appendChild(row);
  });
}

/** Moves the highlighted row up (-1) or down (+1), wrapping around. */
export function moveSuggestionSelection(direction: 1 | -1): void {
  selectedIndex = (selectedIndex + direction + suggestionItems.length) % suggestionItems.length;
  renderSuggestions();
  suggestionBox.children[selectedIndex]?.scrollIntoView({ block: "nearest" });
}

/** Inserts the highlighted suggestion: expands a block, or completes the tag and its closing tag. */
export function acceptSelectedSuggestion(): void {
  const item = suggestionItems[selectedIndex];
  if (!item) return closeSuggestions();
  const { name, block } = item;
  const cursor = editorTextarea.selectionStart;
  const remainder = name.slice(typedPrefix.length);
  const insideCode = isInsideCodeContext(editorTextarea.value.slice(0, cursor));

  if (block && !insideCode) {
    expandBlockAt(cursor - typedPrefix.length - 1, cursor, block);
  } else if (insideCode) {
    insertTextAtCursor(remainder + ">");
  } else {
    insertTextAtCursor(remainder + "></" + name + ">");
    setCursorPosition(cursor + remainder.length + 1);
  }
  closeSuggestions();
}

export function closeSuggestions(): void {
  suggestionBox.hidden = true;
  suggestionItems = [];
}

/**
 * Measures where the caret is by mirroring the textarea's text up to the cursor into a hidden
 * div with the same typography and reading the offset of a marker appended at the end.
 */
function measureCaretPosition(): { x: number; y: number; lineHeight: number } {
  const style = getComputedStyle(editorTextarea);
  const mirror = document.createElement("div");
  const copiedProperties = [
    "fontFamily", "fontSize", "fontWeight", "lineHeight", "letterSpacing", "tabSize",
    "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "boxSizing", "borderWidth",
  ] as const;
  for (const property of copiedProperties) mirror.style[property] = style[property];
  mirror.style.position = "absolute";
  mirror.style.visibility = "hidden";
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.wordWrap = "break-word";
  mirror.style.width = editorTextarea.clientWidth + "px";
  mirror.textContent = editorTextarea.value.slice(0, editorTextarea.selectionStart);

  const marker = document.createElement("span");
  marker.textContent = "​";
  mirror.appendChild(marker);
  document.body.appendChild(mirror);
  const position = { x: marker.offsetLeft, y: marker.offsetTop, lineHeight: parseFloat(style.lineHeight) || 24 };
  mirror.remove();
  return position;
}

/** Places the popup just under the caret, clamped inside the editor area. */
function positionSuggestionBox(): void {
  const caret = measureCaretPosition();
  let left = caret.x - editorTextarea.scrollLeft;
  let top = caret.y + caret.lineHeight - editorTextarea.scrollTop + 2;
  left = Math.max(4, Math.min(left, editorWrap.clientWidth - 210));
  top = Math.max(4, Math.min(top, editorWrap.clientHeight - 60));
  suggestionBox.style.left = left + "px";
  suggestionBox.style.top = top + "px";
}

export function bindSuggestionDismissal(): void {
  editorTextarea.addEventListener("blur", closeSuggestions);
  editorTextarea.addEventListener("click", closeSuggestions);
}
