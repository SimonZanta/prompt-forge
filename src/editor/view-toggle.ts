import {
  backButton, canvasElement, copiedNote, copyButton, editorTextarea, folderChip, saveStatusIndicator, settingsButton, settingsLabel,
  settingsPane, titleInput, viewBlocksButton, viewSegment, viewXmlButton, xmlNote, xmlWrap,
} from "./elements.ts";
import { refreshHighlight, syncHighlightScroll } from "./highlight-layer.ts";
import { parsePromptXml } from "./node-tree.ts";
import { flushSettings, openSettings } from "./settings-pane.ts";
import { editorState, type EditorView } from "./state.ts";
import { closeSuggestions } from "./suggestions.ts";

/**
 * What the main pane shows. Two pages: the editor and settings. Within the editor, Blocks and XML are
 * two views of the same prompt. `content` (the XML string) is always current: the block editor
 * re-serializes after every change, the XML textarea writes it directly. Switching views therefore
 * never loses content; the only one-way step is XML → tree, which fails while the text is mid-edit —
 * then the last valid tree is kept and the Blocks tab waits until the XML parses again.
 *
 * Exactly one pane is visible at a time; the others carry `hidden`, which base.css makes absolute.
 */

let renderBlocks: () => void = () => {};

/** The main pane registers how to redraw its block editor. */
export function bindBlockRenderer(render: () => void): void {
  renderBlocks = render;
}

/** Re-parses the textarea into the tree when possible; updates the Blocks tab availability. */
export function syncTreeFromXml(): void {
  const prompt = editorState.currentPrompt;
  if (!prompt) return;
  prompt.content = editorTextarea.value;
  const parsed = parsePromptXml(prompt.content);
  if (parsed) prompt.tree = parsed;
  prompt.xmlValid = parsed !== null;
  updateToggleState();
}

export function updateToggleState(): void {
  const prompt = editorState.currentPrompt;
  const blocksAvailable = !!prompt && prompt.tree !== null && prompt.xmlValid;
  viewBlocksButton.disabled = !blocksAvailable;
  viewBlocksButton.title = blocksAvailable ? "" : "Fix the XML to edit as blocks";
  xmlNote.hidden = !(prompt && !prompt.xmlValid && !xmlWrap.hidden);
}

/** Remembers the preferred view and shows it — or the XML view when the prompt has no usable tree. */
export function setView(view: EditorView): void {
  editorState.view = view;
  applyView();
}

/** Re-applies page and view to the current state (call after opening or clearing a prompt). */
export function applyView(): void {
  const prompt = editorState.currentPrompt;
  const settings = editorState.page === "settings";
  const blocks = !settings && editorState.view === "blocks" && !!prompt && prompt.tree !== null && prompt.xmlValid;

  settingsPane.hidden = !settings;
  backButton.hidden = !settings;
  settingsLabel.hidden = !settings;
  titleInput.hidden = settings;
  folderChip.hidden = settings || !prompt;
  saveStatusIndicator.hidden = settings;
  viewSegment.hidden = settings;
  copyButton.hidden = settings;
  if (settings) copiedNote.hidden = true;
  settingsButton.setAttribute("aria-pressed", String(settings));

  canvasElement.hidden = settings || !blocks;
  xmlWrap.hidden = settings || blocks;
  viewBlocksButton.setAttribute("aria-pressed", String(blocks));
  viewXmlButton.setAttribute("aria-pressed", String(!settings && !blocks));

  if (blocks) {
    closeSuggestions();
    renderBlocks();
  } else if (!settings && prompt) {
    editorTextarea.value = prompt.content;
    editorState.previousValue = prompt.content;
    refreshHighlight();
    syncHighlightScroll();
  }
  updateToggleState();
}

export function showSettings(): void {
  if (editorState.page === "settings") return;
  editorState.page = "settings";
  closeSuggestions();
  openSettings();
  applyView();
}

export function showEditor(): void {
  if (editorState.page === "editor") return;
  void flushSettings();
  editorState.page = "editor";
  applyView();
}

export function bindViewToggle(): void {
  viewBlocksButton.addEventListener("click", () => setView("blocks"));
  viewXmlButton.addEventListener("click", () => setView("xml"));
  settingsButton.addEventListener("click", () => (editorState.page === "settings" ? showEditor() : showSettings()));
  backButton.addEventListener("click", showEditor);
}
