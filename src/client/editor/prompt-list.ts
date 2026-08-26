import type { Prompt } from "../../prompts/index.ts";
import { apiRequest, jsonRequestOptions } from "../shared/api.ts";
import { flushPendingSave, setSaveStatus } from "./autosave.ts";
import { editorTextarea, newPromptButton, promptListElement, templateMenu, titleInput } from "./elements.ts";
import { refreshHighlight, syncHighlightScroll } from "./highlight-layer.ts";
import { askForName } from "./modal.ts";
import { editorState } from "./state.ts";
import { closeSuggestions } from "./suggestions.ts";
import { PROMPT_TEMPLATES, type PromptTemplate } from "./templates.ts";

/** Sidebar: list of prompts, the "+" template menu, and switching / creating / renaming / deleting prompts. */

export function renderPromptList(): void {
  promptListElement.innerHTML = "";
  for (const prompt of editorState.prompts) {
    const item = document.createElement("li");
    if (editorState.currentPrompt && prompt.id === editorState.currentPrompt.id) item.classList.add("active");

    const name = document.createElement("span");
    name.className = "name";
    name.textContent = prompt.title || "Untitled";
    name.title = "Double-click to rename";
    name.ondblclick = (event) => { event.stopPropagation(); renamePrompt(prompt); };

    const deleteButton = document.createElement("button");
    deleteButton.className = "del";
    deleteButton.textContent = "×";
    deleteButton.title = "Delete";
    deleteButton.onclick = (event) => {
      event.stopPropagation();
      if (confirm('Delete "' + (prompt.title || "Untitled") + '"?')) deletePromptById(prompt.id);
    };

    item.append(name, deleteButton);
    item.onclick = () => selectPrompt(prompt.id);
    promptListElement.appendChild(item);
  }
}

/** Makes the prompt with `promptId` the one being edited (after saving the previous one). */
export async function selectPrompt(promptId: number): Promise<void> {
  await flushPendingSave();
  editorState.currentPrompt = editorState.prompts.find((prompt) => prompt.id === promptId) ?? null;
  if (!editorState.currentPrompt) return;
  titleInput.value = editorState.currentPrompt.title;
  editorTextarea.value = editorState.currentPrompt.content || "";
  editorState.previousValue = editorTextarea.value;
  refreshHighlight();
  syncHighlightScroll();
  renderPromptList();
  setSaveStatus("");
  closeSuggestions();
  editorTextarea.focus();
}

/** Deletes a prompt; if it was open, the first remaining prompt is selected. */
export async function deletePromptById(promptId: number): Promise<void> {
  await apiRequest("/prompts/" + promptId, { method: "DELETE" });
  editorState.prompts = editorState.prompts.filter((prompt) => prompt.id !== promptId);
  if (editorState.currentPrompt && editorState.currentPrompt.id === promptId) {
    editorState.currentPrompt = null;
    editorTextarea.value = "";
    titleInput.value = "";
    editorState.previousValue = "";
    refreshHighlight();
    if (editorState.prompts[0]) {
      renderPromptList();
      return selectPrompt(editorState.prompts[0].id);
    }
  }
  renderPromptList();
}

export async function renamePrompt(prompt: Prompt): Promise<void> {
  const enteredName = await askForName(prompt.title || "Untitled", { title: "Rename prompt", confirmLabel: "Rename" });
  if (enteredName === null) return;
  const title = enteredName.trim() || "Untitled";
  if (title === prompt.title) return;
  await flushPendingSave();
  await apiRequest("/prompts/" + prompt.id, jsonRequestOptions("PUT", { title, content: prompt.content || "" }));
  prompt.title = title;
  if (editorState.currentPrompt && editorState.currentPrompt.id === prompt.id) {
    editorState.currentPrompt.title = title;
    titleInput.value = title;
  }
  renderPromptList();
}

/** Asks for a title, creates the prompt from the template and opens it. */
export async function createPromptFromTemplate(template: PromptTemplate): Promise<void> {
  const defaultTitle = template.name === "Blank" ? "Untitled" : template.name;
  const enteredName = await askForName(defaultTitle, { title: "New prompt", confirmLabel: "Create" });
  if (enteredName === null) return;
  const title = enteredName.trim() || "Untitled";
  await flushPendingSave();
  const created = await apiRequest<Prompt>("/prompts", jsonRequestOptions("POST", { title, content: template.content }));
  editorState.prompts.unshift(created);
  await selectPrompt(created.id);
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

/** Loads all prompts from the server and opens the most recently updated one. */
export async function loadPrompts(): Promise<void> {
  editorState.prompts = await apiRequest<Prompt[]>("/prompts");
  renderPromptList();
  if (editorState.prompts[0]) await selectPrompt(editorState.prompts[0].id);
}
