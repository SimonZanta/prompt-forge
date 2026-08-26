import type { Tag } from "../../tags/index.ts";
import { isValidTagName } from "../../tags/tag-validation.ts";
import { apiRequest, jsonRequestOptions } from "../shared/api.ts";
import { queryElement } from "../shared/dom.ts";
import { createDebouncedSaver } from "./debounced-saver.ts";

/** "Tags" section: editable chips for permanent tags plus an "+ Add tag" chip. */

const tagListElement = queryElement<HTMLDivElement>("#tags-list");
const tagStatusElement = queryElement<HTMLSpanElement>("#tags-status");
const tagSaver = createDebouncedSaver(tagStatusElement);

let tags: Tag[] = [];

async function saveTag(tag: Tag): Promise<void> {
  const saved = await apiRequest<Tag>("/tags/" + tag.id, jsonRequestOptions("PUT", { name: tag.name }));
  Object.assign(tag, saved);
}

/** Makes the chip input exactly as wide as its text (or placeholder). */
function fitInputWidthToValue(input: HTMLInputElement): void {
  input.style.width = Math.max(1, (input.value || input.placeholder || "").length + 1) + "ch";
}

function isTagNameAvailable(name: string, ownTag: Tag | null): boolean {
  return isValidTagName(name) && !tags.some((other) => other !== ownTag && other.name === name);
}

function renderTagChip(tag: Tag): HTMLSpanElement {
  const chip = document.createElement("span");
  chip.className = "tag";
  chip.dataset.id = String(tag.id);

  const nameInput = document.createElement("input");
  nameInput.value = tag.name;
  nameInput.spellcheck = false;
  nameInput.autocomplete = "off";
  nameInput.title = "Tag name (letters, digits, _ . : -)";
  fitInputWidthToValue(nameInput);
  nameInput.addEventListener("input", () => {
    fitInputWidthToValue(nameInput);
    const name = nameInput.value.trim();
    const available = isTagNameAvailable(name, tag);
    chip.classList.toggle("invalid", !available);
    if (!available) return;
    tag.name = name;
    tagSaver.schedule(tag.id, () => saveTag(tag));
  });
  // leaving the field reverts an invalid edit and normalises whitespace
  nameInput.addEventListener("blur", () => {
    if (chip.classList.contains("invalid") || nameInput.value !== tag.name) {
      nameInput.value = tag.name;
      fitInputWidthToValue(nameInput);
      chip.classList.remove("invalid");
    }
  });
  nameInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") { event.preventDefault(); nameInput.blur(); }
  });

  const deleteButton = document.createElement("button");
  deleteButton.className = "del";
  deleteButton.textContent = "×";
  deleteButton.title = "Delete tag";
  deleteButton.onclick = async () => {
    await apiRequest("/tags/" + tag.id, { method: "DELETE" });
    tags = tags.filter((other) => other.id !== tag.id);
    renderTagList();
  };

  chip.append(nameInput, deleteButton);
  return chip;
}

function renderAddTagChip(): HTMLSpanElement {
  const chip = document.createElement("span");
  chip.className = "tag tag-add";

  const nameInput = document.createElement("input");
  nameInput.id = "tags-add";
  nameInput.placeholder = "+ Add tag";
  nameInput.spellcheck = false;
  nameInput.autocomplete = "off";
  fitInputWidthToValue(nameInput);
  nameInput.addEventListener("input", () => {
    fitInputWidthToValue(nameInput);
    const name = nameInput.value.trim();
    chip.classList.toggle("invalid", !!name && !isTagNameAvailable(name, null));
  });
  nameInput.addEventListener("keydown", async (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const name = nameInput.value.trim();
    if (!isTagNameAvailable(name, null)) { chip.classList.add("invalid"); return; }
    try {
      const created = await apiRequest<Tag>("/tags", jsonRequestOptions("POST", { name }));
      tags.push(created);
      renderTagList();
      queryElement<HTMLInputElement>("#tags-add").focus();
    } catch (error) {
      chip.classList.add("invalid");
      tagStatusElement.textContent = "!";
      tagStatusElement.title = error instanceof Error ? error.message : String(error);
    }
  });

  chip.appendChild(nameInput);
  return chip;
}

function renderTagList(): void {
  tags.sort((a, b) => a.name.localeCompare(b.name));
  tagListElement.innerHTML = "";
  for (const tag of tags) tagListElement.appendChild(renderTagChip(tag));
  tagListElement.appendChild(renderAddTagChip());
}

export async function loadTags(): Promise<void> {
  tags = await apiRequest<Tag[]>("/tags");
  renderTagList();
}

export function bindTagsSection(): void {
  window.addEventListener("beforeunload", () => { tagSaver.flush(); });
}
