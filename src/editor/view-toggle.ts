import { canvasElement, editorTextarea, viewBlocksButton, viewXmlButton, xmlNote, xmlWrap } from "./elements.ts";
import { refreshHighlight, syncHighlightScroll } from "./highlight-layer.ts";
import { parsePromptXml } from "./node-tree.ts";
import { editorState, type EditorView } from "./state.ts";
import { closeSuggestions } from "./suggestions.ts";

/**
 * Blocks and XML are two views of the same prompt. `content` (the XML string) is always current: the
 * block editor re-serializes after every change, the XML textarea writes it directly. Switching views
 * therefore never loses content; the only one-way step is XML → tree, which fails while the text is
 * mid-edit — then the last valid tree is kept and the Blocks tab waits until the XML parses again.
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
  xmlNote.hidden = !(prompt && !prompt.xmlValid && canvasElement.hidden);
}

/** Remembers the preferred view and shows it — or the XML view when the prompt has no usable tree. */
export function setView(view: EditorView): void {
  editorState.view = view;
  applyView();
}

/** Re-applies the preferred view to the current prompt (call after opening or clearing a prompt). */
export function applyView(): void {
  const prompt = editorState.currentPrompt;
  const blocks = editorState.view === "blocks" && !!prompt && prompt.tree !== null && prompt.xmlValid;

  canvasElement.hidden = !blocks;
  xmlWrap.hidden = blocks;
  viewBlocksButton.setAttribute("aria-pressed", String(blocks));
  viewXmlButton.setAttribute("aria-pressed", String(!blocks));

  if (blocks) {
    closeSuggestions();
    renderBlocks();
  } else if (prompt) {
    editorTextarea.value = prompt.content;
    editorState.previousValue = prompt.content;
    refreshHighlight();
    syncHighlightScroll();
  }
  updateToggleState();
}

export function bindViewToggle(): void {
  viewBlocksButton.addEventListener("click", () => setView("blocks"));
  viewXmlButton.addEventListener("click", () => setView("xml"));
}
