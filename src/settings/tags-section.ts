import { loadSettings, saveSettings } from "../storage/settings-store.ts";
import { isValidTagName } from "../storage/tag-validation.ts";
import { queryElement } from "../shared/dom.ts";
import { createDebouncedSaver } from "./debounced-saver.ts";

/** "Tags" section: editable chips for permanent tags plus an "+ Add tag" chip. */

/** Tags are stored as plain strings; the wrapper object gives each chip a stable identity while its name is edited. */
interface Tag {
  name: string;
}

const tagListElement = queryElement<HTMLDivElement>("#tags-list");
const tagStatusElement = queryElement<HTMLSpanElement>("#tags-status");
const tagSaver = createDebouncedSaver(tagStatusElement);

let tags: Tag[] = [];

function persistTags(): void {
  saveSettings({ tags: tags.map((tag) => tag.name) });
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
    tagSaver.schedule("tags", async () => { persistTags(); });
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
  deleteButton.onclick = () => {
    tags = tags.filter((other) => other !== tag);
    persistTags();
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
  nameInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const name = nameInput.value.trim();
    if (!isTagNameAvailable(name, null)) { chip.classList.add("invalid"); return; }
    tags.push({ name });
    persistTags();
    renderTagList();
    queryElement<HTMLInputElement>("#tags-add").focus();
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

export function loadTags(): void {
  tags = loadSettings().tags.map((name) => ({ name }));
  renderTagList();
}

export function bindTagsSection(): void {
  window.addEventListener("beforeunload", () => { tagSaver.flush(); });
}
