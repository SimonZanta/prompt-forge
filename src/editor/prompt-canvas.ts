import { scheduleSave } from "./autosave.ts";
import { createBlockEditor, type BlockEditor } from "./block-editor.ts";
import { canvasElement } from "./elements.ts";
import { openInsertMenu } from "./insert-menu.ts";
import { collectTagNames, serializeTree } from "./node-tree.ts";
import { editorState } from "./state.ts";
import { bindBlockRenderer } from "./view-toggle.ts";

/** The main block editor: edits the open prompt's tree and keeps `content` (the saved XML) in step. */

let canvas: BlockEditor;

function tagsInUse(): Iterable<string> {
  return editorState.currentPrompt?.tree ? collectTagNames(editorState.currentPrompt.tree.nodes) : [];
}

function afterChange(): void {
  const prompt = editorState.currentPrompt;
  if (!prompt?.tree) return;
  prompt.content = serializeTree(prompt.tree);
  prompt.xmlValid = true;
  scheduleSave();
}

function renderCanvas(): void {
  const prompt = editorState.currentPrompt;
  canvasElement.classList.toggle("no-prompt", !prompt?.tree);
  if (!prompt?.tree) {
    canvasElement.replaceChildren();
    return;
  }
  canvas.render();
}

/** Opens the insert menu for the whole prompt (the `/` key when nothing editable has focus). */
export function openRootInsertMenu(): void {
  const addRow = canvasElement.querySelector<HTMLElement>('[data-action="add-root"]');
  if (addRow) openInsertMenu({ mode: "insert", anchor: addRow, tagsInUse: tagsInUse(), onPick: (nodes) => canvas.insert(null, nodes) });
}

export function bindPromptCanvas(): void {
  canvas = createBlockEditor(canvasElement, {
    getNodes: () => editorState.currentPrompt?.tree?.nodes ?? [],
    onChange: afterChange,
    onInsert: (anchor, parentId) =>
      openInsertMenu({ mode: "insert", anchor, tagsInUse: tagsInUse(), onPick: (nodes) => canvas.insert(parentId, nodes) }),
    onLinkRequest: (anchor, insertLink) =>
      openInsertMenu({ mode: "link", anchor, tagsInUse: tagsInUse(), onPick: insertLink }),
  });
  bindBlockRenderer(renderCanvas);

  document.addEventListener("keydown", (event) => {
    if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest("input, textarea, [contenteditable]")) return;
    if (editorState.view !== "blocks" || !editorState.currentPrompt?.tree) return;
    event.preventDefault();
    openRootInsertMenu();
  });
}
