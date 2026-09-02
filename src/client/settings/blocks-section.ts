import type { Block } from "../../blocks/index.ts";
import { isValidBlockCommand } from "../../blocks/block-validation.ts";
import { apiRequest, jsonRequestOptions } from "../shared/api.ts";
import { queryElement } from "../shared/dom.ts";
import { createDebouncedSaver } from "./debounced-saver.ts";

/** "Custom blocks" section: one row per block with an editable command and content. */

const blockListElement = queryElement<HTMLDivElement>("#blocks-list");
const addBlockButton = queryElement<HTMLButtonElement>("#blocks-add");
const blockSaver = createDebouncedSaver(queryElement<HTMLSpanElement>("#blocks-status"));

let blocks: Block[] = [];

async function saveBlock(block: Block): Promise<void> {
  const saved = await apiRequest<Block>("/blocks/" + block.id, jsonRequestOptions("PUT", { command: block.command, content: block.content }));
  Object.assign(block, saved);
}

/** Grows the textarea to fit its content so no inner scrollbar appears. */
function fitTextareaHeightToContent(textarea: HTMLTextAreaElement): void {
  textarea.style.height = "auto";
  textarea.style.height = textarea.scrollHeight + 2 + "px";
}

function isCommandAvailable(command: string, ownBlock: Block): boolean {
  return isValidBlockCommand(command) && !blocks.some((other) => other !== ownBlock && other.command === command);
}

function renderBlockRow(block: Block): HTMLDivElement {
  const row = document.createElement("div");
  row.className = "block";
  row.dataset.id = String(block.id);

  const commandInput = document.createElement("input");
  commandInput.value = block.command;
  commandInput.placeholder = "command";
  commandInput.spellcheck = false;
  commandInput.autocomplete = "off";
  commandInput.title = "Command (letters, digits, _ . -)";
  commandInput.addEventListener("input", () => {
    const command = commandInput.value.trim();
    const available = isCommandAvailable(command, block);
    commandInput.classList.toggle("invalid", !available);
    if (!available) return;
    block.command = command;
    blockSaver.schedule(block.id, () => saveBlock(block));
  });

  const deleteButton = document.createElement("button");
  deleteButton.className = "del";
  deleteButton.textContent = "×";
  deleteButton.title = "Delete block";
  deleteButton.onclick = async () => {
    if (!confirm('Delete block "' + block.command + '"?')) return;
    await apiRequest("/blocks/" + block.id, { method: "DELETE" });
    blocks = blocks.filter((other) => other.id !== block.id);
    renderBlockList();
  };

  const contentTextarea = document.createElement("textarea");
  contentTextarea.value = block.content;
  contentTextarea.placeholder = "<tag>\n  <child></child>\n</tag>";
  contentTextarea.spellcheck = false;
  contentTextarea.addEventListener("input", () => {
    fitTextareaHeightToContent(contentTextarea);
    block.content = contentTextarea.value;
    blockSaver.schedule(block.id, () => saveBlock(block));
  });
  // Tab inserts two spaces instead of moving focus
  contentTextarea.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    event.preventDefault();
    contentTextarea.setRangeText("  ", contentTextarea.selectionStart, contentTextarea.selectionEnd, "end");
    contentTextarea.dispatchEvent(new Event("input"));
  });

  row.append(commandInput, deleteButton, contentTextarea);
  requestAnimationFrame(() => fitTextareaHeightToContent(contentTextarea));
  return row;
}

function renderBlockList(): void {
  blockListElement.innerHTML = "";
  if (!blocks.length) {
    const emptyNote = document.createElement("div");
    emptyNote.className = "empty";
    emptyNote.textContent = "No custom blocks yet.";
    blockListElement.appendChild(emptyNote);
    return;
  }
  for (const block of blocks) blockListElement.appendChild(renderBlockRow(block));
}

/** First unused name in the series `block-1`, `block-2`, … */
function nextFreeCommandName(): string {
  let counter = 1;
  while (blocks.some((block) => block.command === "block-" + counter)) counter++;
  return "block-" + counter;
}

async function addBlock(): Promise<void> {
  const created = await apiRequest<Block>("/blocks", jsonRequestOptions("POST", { command: nextFreeCommandName(), content: "" }));
  blocks.push(created);
  renderBlockList();
  const row = blockListElement.querySelector<HTMLDivElement>('.block[data-id="' + created.id + '"]');
  if (row) {
    const commandInput = row.querySelector("input");
    commandInput?.focus();
    commandInput?.select();
    row.scrollIntoView({ block: "nearest" });
  }
}

export async function loadBlocks(): Promise<void> {
  blocks = await apiRequest<Block[]>("/blocks");
  renderBlockList();
}

export function bindBlocksSection(): void {
  addBlockButton.onclick = addBlock;
  window.addEventListener("beforeunload", () => { blockSaver.flush(); });
}
