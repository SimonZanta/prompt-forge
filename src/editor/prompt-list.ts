import { promptStore } from "../storage/active-prompt-store.ts";
import type { Prompt, PromptListItem } from "../storage/prompt-store.ts";
import { cancelPendingSave, flushPendingSave, setSaveStatus } from "./autosave.ts";
import { editorTextarea, newPromptButton, promptListElement, templateMenu, titleInput } from "./elements.ts";
import { refreshHighlight, syncHighlightScroll } from "./highlight-layer.ts";
import { askForName } from "./modal.ts";
import { editorState } from "./state.ts";
import { closeSuggestions } from "./suggestions.ts";
import { PROMPT_TEMPLATES, type PromptTemplate } from "./templates.ts";

/** Sidebar prompts pane: the file list of the open folder, the "+" template menu,
    and switching / creating / renaming / deleting prompts. */

/** Empties the editor when the open prompt (or its folder) was deleted. */
export function clearEditor(): void {
  editorState.currentPrompt = null;
  editorTextarea.value = "";
  titleInput.value = "";
  editorState.previousValue = "";
  cancelPendingSave();
  setSaveStatus("");
  refreshHighlight();
}

export function renderPromptList(): void {
  promptListElement.innerHTML = "";
  const { currentFolder, currentPrompt } = editorState;
  for (const prompt of editorState.prompts) {
    const item = document.createElement("li");
    if (currentPrompt && currentPrompt.folder === currentFolder && currentPrompt.name === prompt.name) {
      item.classList.add("active");
    }

    const name = document.createElement("span");
    name.className = "name";
    name.textContent = prompt.name;
    name.title = "Double-click to rename";
    name.ondblclick = (event) => { event.stopPropagation(); renamePrompt(prompt); };

    const deleteButton = document.createElement("button");
    deleteButton.className = "del";
    deleteButton.textContent = "×";
    deleteButton.title = "Delete";
    deleteButton.onclick = (event) => {
      event.stopPropagation();
      if (confirm('Delete "' + prompt.name + '"?')) deletePromptByName(prompt.name);
    };

    item.append(name, deleteButton);
    item.onclick = () => selectPrompt(prompt.name);
    promptListElement.appendChild(item);
  }
}

/** Reloads the file list of the open folder from the active store. */
export async function refreshPromptList(): Promise<void> {
  if (editorState.currentFolder === null) return;
  editorState.prompts = await promptStore().listPrompts(editorState.currentFolder);
  renderPromptList();
}

/** Opens the prompt named `name` from the current folder (after saving the previous one). */
export async function selectPrompt(name: string): Promise<void> {
  await flushPendingSave();
  const folder = editorState.currentFolder;
  if (folder === null) return;
  let prompt: Prompt;
  try {
    prompt = await promptStore().readPrompt(folder, name);
  } catch {
    return;
  }
  editorState.currentPrompt = { folder, name: prompt.name, content: prompt.content || "" };
  titleInput.value = prompt.name;
  editorTextarea.value = prompt.content || "";
  editorState.previousValue = editorTextarea.value;
  refreshHighlight();
  syncHighlightScroll();
  renderPromptList();
  setSaveStatus("");
  closeSuggestions();
  editorTextarea.focus();
}

/** Deletes a prompt; if it was open, the first remaining prompt is selected. */
export async function deletePromptByName(name: string): Promise<void> {
  const folder = editorState.currentFolder;
  if (folder === null) return;
  await promptStore().deletePrompt(folder, name);
  editorState.prompts = editorState.prompts.filter((prompt) => prompt.name !== name);
  const current = editorState.currentPrompt;
  if (current && current.folder === folder && current.name === name) {
    clearEditor();
    if (editorState.prompts[0]) {
      renderPromptList();
      return selectPrompt(editorState.prompts[0].name);
    }
  }
  renderPromptList();
}

export async function renamePrompt(prompt: PromptListItem): Promise<void> {
  const folder = editorState.currentFolder;
  if (folder === null) return;
  const enteredName = await askForName(prompt.name, { title: "Rename prompt", confirmLabel: "Rename" });
  if (enteredName === null) return;
  const newName = enteredName.trim();
  if (!newName || newName === prompt.name) return;
  await flushPendingSave();
  let renamed: Prompt;
  try {
    renamed = await promptStore().renamePrompt(folder, prompt.name, newName);
  } catch (error) {
    alert(error instanceof Error ? error.message : String(error));
    return;
  }
  const current = editorState.currentPrompt;
  if (current && current.folder === folder && current.name === prompt.name) {
    current.name = renamed.name;
    titleInput.value = renamed.name;
  }
  prompt.name = renamed.name;
  renderPromptList();
}

/** Asks for a name, creates the prompt file from the template and opens it. */
export async function createPromptFromTemplate(template: PromptTemplate): Promise<void> {
  const folder = editorState.currentFolder;
  if (folder === null) return;
  const defaultName = template.name === "Blank" ? "Untitled" : template.name;
  const enteredName = await askForName(defaultName, { title: "New prompt", confirmLabel: "Create" });
  if (enteredName === null || !enteredName.trim()) return;
  await flushPendingSave();
  let created: Prompt;
  try {
    created = await promptStore().createPrompt(folder, enteredName.trim(), template.content);
  } catch (error) {
    alert(error instanceof Error ? error.message : String(error));
    return;
  }
  await refreshPromptList();
  await selectPrompt(created.name);
  editorTextarea.focus();
}

function renderTemplateMenu(): void {
  templateMenu.innerHTML = '<div class="tmenu-label">NEW FROM TEMPLATE</div>';
  for (const template of PROMPT_TEMPLATES) {
    const item = document.createElement("div");
    item.className = "item";
    item.textContent = template.name;
    item.onclick = (event) => {
      event.stopPropagation();
      templateMenu.hidden = true;
      createPromptFromTemplate(template);
    };
    templateMenu.appendChild(item);
  }
}

/** The "+" button toggles the template menu; clicking anywhere else closes it. */
export function bindTemplateMenu(): void {
  renderTemplateMenu();
  newPromptButton.onclick = (event) => {
    event.stopPropagation();
    templateMenu.hidden = !templateMenu.hidden;
  };
  document.addEventListener("click", () => { templateMenu.hidden = true; });
}
