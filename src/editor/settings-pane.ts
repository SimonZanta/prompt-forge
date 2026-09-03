import { ACCENT_PRESETS, applyAccent, currentAccent, resetAccent } from "../shared/accent.ts";
import { iconButton } from "../shared/icons.ts";
import { isValidBlockCommand } from "../storage/block-validation.ts";
import { loadSettings, saveSettings, type Block } from "../storage/settings-store.ts";
import { isValidTagName } from "../storage/tag-validation.ts";
import { createBlockEditor } from "./block-editor.ts";
import { loadBlocks } from "./custom-blocks.ts";
import { createDebouncedSaver } from "./debounced-saver.ts";
import { settingsPane, settingsStatus } from "./elements.ts";
import { describeFragment, openInsertMenu } from "./insert-menu.ts";
import { collectTagNames, createNode, parseFragmentXml, serializeNodes, type PromptNode } from "./node-tree.ts";
import { loadPermanentTags } from "./permanent-tags.ts";

/**
 * The settings page, shown in place of the editor: custom blocks, tags, accent.
 *
 * A block definition is edited as a node fragment with the same block editor as the prompt canvas,
 * or as XML in a textarea — the two are the same data. On disk the definition stays an XML string
 * (`Block.content`), like a prompt file; the fragment is derived from it here. While the XML in a
 * textarea does not parse, the last valid fragment is kept and nothing is saved until it parses again.
 */

interface BlockCard {
  block: Block;
  /** Last valid fragment; null only when the stored XML never parsed (then only XML mode is offered). */
  nodes: PromptNode[] | null;
  mode: "blocks" | "xml";
}

const INVALID_HINT = "not valid XML yet";

let cards: BlockCard[] = [];
let tags: string[] = [];
const saver = createDebouncedSaver(settingsStatus);

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, ...children: (Node | string)[]): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.append(...children);
  return node;
}

// ---------- persistence ----------

function persistBlocks(): void {
  saver.schedule("blocks", async () => {
    saveSettings({ blocks: cards.map((card) => card.block) });
    loadBlocks();
  });
}

function persistTags(): void {
  saveSettings({ tags });
  loadPermanentTags();
}

/** Writes any pending block edits now (leaving the page, unloading). */
export function flushSettings(): Promise<void> {
  return saver.flush();
}

// ---------- custom blocks ----------

function isCommandFree(command: string, own: BlockCard): boolean {
  return isValidBlockCommand(command) && !cards.some((card) => card !== own && card.block.command === command);
}

function nextFreeCommand(): string {
  let counter = 1;
  const taken = new Set(cards.map((card) => card.block.command));
  while (taken.has(`new-block${counter > 1 ? "-" + counter : ""}`)) counter++;
  return `new-block${counter > 1 ? "-" + counter : ""}`;
}

function hintFor(card: BlockCard): { text: string; bad: boolean } {
  return card.nodes ? { text: describeFragment(card.nodes), bad: false } : { text: INVALID_HINT, bad: true };
}

function renderBlockCard(card: BlockCard): HTMLElement {
  const name = document.createElement("input");
  name.className = "cbname";
  name.value = card.block.command;
  name.spellcheck = false;
  name.autocomplete = "off";
  name.setAttribute("aria-label", "Block name");
  name.title = "Command (letters, digits, _ . -)";
  name.addEventListener("input", () => {
    const command = name.value.trim();
    const free = isCommandFree(command, card);
    name.classList.toggle("invalid", !free);
    if (!free) return;
    card.block.command = command;
    persistBlocks();
  });

  const segment = element("div", "seg");
  segment.setAttribute("role", "group");
  segment.setAttribute("aria-label", "Definition mode");
  for (const mode of ["blocks", "xml"] as const) {
    const button = element("button", "", mode === "blocks" ? "Blocks" : "XML");
    button.type = "button";
    button.setAttribute("aria-pressed", String(card.mode === mode));
    button.disabled = mode === "blocks" && !card.nodes;
    if (button.disabled) button.title = "Fix the XML to edit as blocks";
    button.addEventListener("click", () => {
      if (card.mode === mode) return;
      card.mode = mode;
      renderSettings();
    });
    segment.appendChild(button);
  }

  const remove = iconButton("x", "Delete block");
  remove.addEventListener("click", () => {
    if (!confirm(`Delete block "${card.block.command}"?`)) return;
    cards = cards.filter((other) => other !== card);
    persistBlocks();
    renderSettings();
  });

  const hint = element("span", "");
  const foot = element("div", "cbfoot", hint);
  const showHint = () => {
    const { text, bad } = hintFor(card);
    hint.textContent = text;
    hint.classList.toggle("bad", bad);
  };
  showHint();

  let body: HTMLElement;
  if (card.mode === "blocks" && card.nodes) {
    const nodes = card.nodes;
    body = element("div", "cbedit");
    const editor = createBlockEditor(body, {
      getNodes: () => nodes,
      onChange: () => {
        card.block.content = serializeNodes(nodes, 0);
        showHint();
        persistBlocks();
      },
      onInsert: (anchor, parentId) =>
        openInsertMenu({ mode: "insert", anchor, tagsInUse: collectTagNames(nodes), onPick: (picked) => editor.insert(parentId, picked) }),
      onLinkRequest: (anchor, insertLink) =>
        openInsertMenu({ mode: "link", anchor, tagsInUse: collectTagNames(nodes), onPick: insertLink }),
    });
    editor.render();
  } else {
    const xml = document.createElement("textarea");
    xml.className = "cbxml";
    xml.value = card.block.content;
    xml.spellcheck = false;
    xml.setAttribute("aria-label", "Block XML");
    xml.placeholder = "<tag>\n  <child></child>\n</tag>";
    xml.addEventListener("input", () => {
      const parsed = parseFragmentXml(xml.value);
      if (!parsed) {
        hint.textContent = INVALID_HINT;
        hint.classList.add("bad");
        return;
      }
      card.nodes = parsed;
      card.block.content = xml.value;
      showHint();
      persistBlocks();
    });
    // Tab inserts two spaces instead of moving focus
    xml.addEventListener("keydown", (event) => {
      if (event.key !== "Tab") return;
      event.preventDefault();
      xml.setRangeText("  ", xml.selectionStart, xml.selectionEnd, "end");
      xml.dispatchEvent(new Event("input"));
    });
    body = xml;
  }

  return element("div", "cblock", element("div", "cbtop", name, segment, remove), body, foot);
}

function renderBlocksSection(): HTMLElement {
  const add = element("button", "btn", "+ Add block");
  add.type = "button";
  add.addEventListener("click", () => {
    const nodes = [createNode("tag")];
    cards.push({ block: { command: nextFreeCommand(), content: serializeNodes(nodes, 0) }, nodes, mode: "blocks" });
    persistBlocks();
    renderSettings();
    const last = settingsPane.querySelector<HTMLInputElement>(".cblock:last-of-type .cbname");
    last?.focus();
    last?.select();
    last?.scrollIntoView({ block: "nearest" });
  });
  const hint = element("p", "hint");
  hint.append("Type ", element("code", "", "/"), " in the editor and pick a block to insert the structure below. Define it either way — the two views are the same data.");
  return element("section", "sect",
    element("div", "secthead", element("h2", "", "Custom blocks"), add),
    hint,
    ...(cards.length ? cards.map(renderBlockCard) : [element("p", "hint", "No blocks yet.")]));
}

// ---------- tags ----------

function renderTagsSection(): HTMLElement {
  const chips = element("div", "chips");
  for (const tag of tags) {
    const remove = element("button", "", "");
    remove.type = "button";
    remove.setAttribute("aria-label", `Remove ${tag}`);
    remove.appendChild(iconButton("x", `Remove ${tag}`, "").firstElementChild!);
    remove.addEventListener("click", () => {
      tags = tags.filter((other) => other !== tag);
      persistTags();
      renderSettings();
    });
    chips.appendChild(element("span", "tagchip", tag, remove));
  }
  const input = document.createElement("input");
  input.className = "newtag";
  input.placeholder = "+ add tag";
  input.spellcheck = false;
  input.autocomplete = "off";
  input.setAttribute("aria-label", "New tag");
  input.addEventListener("input", () => {
    const name = input.value.trim();
    input.classList.toggle("invalid", !!name && (!isValidTagName(name) || tags.includes(name)));
  });
  input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const name = input.value.trim();
    if (!isValidTagName(name) || tags.includes(name)) {
      input.classList.add("invalid");
      return;
    }
    tags.push(name);
    tags.sort((a, b) => a.localeCompare(b));
    persistTags();
    renderSettings();
    settingsPane.querySelector<HTMLInputElement>(".newtag")?.focus();
  });
  chips.appendChild(input);
  return element("section", "sect",
    element("h2", "", "Tags"),
    element("p", "hint", "Permanent tags are always offered in the insert menu, alongside tags already used in the prompt."),
    chips);
}

// ---------- accent ----------

function renderAccentSection(): HTMLElement {
  const presets = element("div", "presets");
  const error = element("p", "palerr");
  error.setAttribute("role", "status");
  const picker = document.createElement("input");
  picker.type = "color";
  picker.setAttribute("aria-label", "Pick a colour");
  const hex = document.createElement("input");
  hex.className = "hex";
  hex.spellcheck = false;
  hex.setAttribute("aria-label", "Hex value");

  const reflect = () => {
    const accent = currentAccent();
    picker.value = accent;
    hex.value = accent;
    presets.querySelectorAll<HTMLButtonElement>(".preset").forEach((button) =>
      button.setAttribute("aria-pressed", String(button.dataset.hex === accent)));
  };
  const apply = (value: string) => {
    if (applyAccent(value)) {
      error.textContent = "";
      reflect();
    } else {
      error.textContent = "Use a six-digit hex, like #4C8DF5";
    }
  };

  for (const preset of ACCENT_PRESETS) {
    const button = element("button", "preset");
    button.type = "button";
    button.dataset.hex = preset.hex;
    button.style.background = preset.hex;
    button.title = preset.name;
    button.setAttribute("aria-label", preset.name);
    button.addEventListener("click", () => apply(preset.hex));
    presets.appendChild(button);
  }
  picker.addEventListener("input", () => apply(picker.value));
  hex.addEventListener("change", () => apply(hex.value));
  const reset = element("button", "reset", "Reset");
  reset.type = "button";
  reset.addEventListener("click", () => { resetAccent(); error.textContent = ""; reflect(); });
  reflect();

  return element("section", "sect",
    element("h2", "", "Accent"),
    element("p", "hint", "One colour drives every highlight in the app — tag chips, the active prompt, focus rings. Tints are derived from it for each theme."),
    presets,
    element("div", "customrow", picker, hex, reset),
    error);
}

// ---------- page ----------

export function renderSettings(): void {
  settingsPane.replaceChildren(renderBlocksSection(), renderTagsSection(), renderAccentSection());
}

/** Reads settings from storage and shows the page. */
export function openSettings(): void {
  const settings = loadSettings();
  cards = settings.blocks.map((block) => {
    const nodes = parseFragmentXml(block.content);
    return { block: { ...block }, nodes, mode: nodes ? "blocks" : "xml" };
  });
  tags = [...settings.tags].sort((a, b) => a.localeCompare(b));
  renderSettings();
}

export function bindSettingsPane(): void {
  window.addEventListener("beforeunload", () => { void saver.flush(); });
}
