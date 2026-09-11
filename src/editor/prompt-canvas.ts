import { scheduleSave } from "./autosave.ts";
import { createBlockEditor, type BlockEditor } from "./block-editor.ts";
import { canvasElement } from "./elements.ts";
import { openInsertMenu } from "./insert-menu.ts";
import { collectLinkedTagNames, collectTagNames, serializeTree } from "./node-tree.ts";
import { editorState } from "./state.ts";
import { bindBlockRenderer } from "./view-toggle.ts";

/** The main block editor: edits the open prompt's tree and keeps `content` (the saved XML) in step. */

let canvas: BlockEditor;

/** Tags the menus offer first: every block's tag plus every `[[tag]]` referenced in text, so a tag linked
 *  before its block exists is picked from the list instead of retyped. */
function tagsInUse(): Iterable<string> {
  const nodes = editorState.currentPrompt?.tree?.nodes;
  if (!nodes) return [];
  return new Set([...collectTagNames(nodes), ...collectLinkedTagNames(nodes)]);
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
    if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented) return;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest("input, textarea, [contenteditable]")) return;
    if (editorState.page !== "editor" || editorState.view !== "blocks" || !editorState.currentPrompt?.tree) return;
    event.preventDefault();
    openRootInsertMenu();
  });
}
