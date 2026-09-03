import { pathSegments } from "../storage/prompt-store.ts";
import { tooltipElement, treeElement } from "./elements.ts";

/**
 * Hover / focus tooltip for rail rows: the full name plus the folder path it sits in. Rendered outside
 * the rail's scroll container (fixed, in <body>) so the rail edge cannot clip it; opens toward the
 * editor and flips to the other side when there is no room.
 */

const SHOW_DELAY_MS = 180;
const GAP = 8;

let showTimer: ReturnType<typeof setTimeout> | null = null;

export function hideTooltip(): void {
  if (showTimer) clearTimeout(showTimer);
  showTimer = null;
  tooltipElement.hidden = true;
}

function describe(rowElement: HTMLElement): { name: string; path: string[] } | null {
  const { folder, prompt } = rowElement.dataset;
  if (!folder) return null;
  if (prompt) return { name: prompt, path: pathSegments(folder) };
  const segments = pathSegments(folder);
  return { name: segments.pop()!, path: segments };
}

function showTooltip(rowElement: HTMLElement): void {
  const info = describe(rowElement);
  if (!info) return;
  const name = document.createElement("span");
  name.className = "tipname";
  name.textContent = info.name;
  tooltipElement.replaceChildren(name);
  if (info.path.length) {
    const path = document.createElement("span");
    path.className = "tippath";
    path.textContent = info.path.join(" / ");
    tooltipElement.appendChild(path);
  }
  tooltipElement.hidden = false;
  tooltipElement.style.left = "0px";
  tooltipElement.style.top = "0px";
  const rowRect = rowElement.getBoundingClientRect();
  const tipRect = tooltipElement.getBoundingClientRect();
  let left = rowRect.left - tipRect.width - GAP;
  if (left < GAP) left = Math.min(rowRect.right + GAP, window.innerWidth - tipRect.width - GAP);
  const top = Math.max(GAP, Math.min(rowRect.top + rowRect.height / 2 - tipRect.height / 2, window.innerHeight - tipRect.height - GAP));
  tooltipElement.style.left = left + "px";
  tooltipElement.style.top = top + "px";
}

/** A row that can have a tooltip: a folder or a prompt whose name is not being edited. */
function describableRow(target: EventTarget | null): HTMLElement | null {
  const rowElement = target instanceof Element ? target.closest<HTMLElement>(".row") : null;
  if (!rowElement || !rowElement.dataset.folder || rowElement.querySelector("[data-renamer]")) return null;
  return rowElement;
}

export function bindTooltip(): void {
  treeElement.addEventListener("pointerover", (event) => {
    const rowElement = describableRow(event.target);
    if (!rowElement) return hideTooltip();
    if (showTimer) clearTimeout(showTimer);
    showTimer = setTimeout(() => showTooltip(rowElement), SHOW_DELAY_MS);
  });
  treeElement.addEventListener("pointerout", (event) => {
    if (!describableRow(event.relatedTarget)) hideTooltip();
  });
  treeElement.addEventListener("focusin", (event) => {
    const rowElement = describableRow(event.target);
    // focus lands on the row itself (keyboard); an auto-focused rename field must not trigger it
    if (rowElement && event.target === rowElement) showTooltip(rowElement);
    else hideTooltip();
  });
  treeElement.addEventListener("focusout", hideTooltip);
  treeElement.addEventListener("scroll", hideTooltip);
  treeElement.addEventListener("pointerdown", hideTooltip);
  window.addEventListener("blur", hideTooltip);
}
