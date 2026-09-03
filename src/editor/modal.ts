import { queryElement } from "../shared/dom.ts";

/** Small "enter a name" dialog used for creating and renaming prompts. */

const modal = queryElement<HTMLDivElement>("#modal");
const modalTitle = queryElement<HTMLHeadingElement>("#modal-title");
const modalInput = queryElement<HTMLInputElement>("#modal-input");
const confirmButton = queryElement<HTMLButtonElement>("#modal-ok");
const cancelButton = queryElement<HTMLButtonElement>("#modal-cancel");

/** Resolves the currently open dialog; `null` when none is open. */
let resolveOpenDialog: ((value: string | null) => void) | null = null;

/** Whether the name dialog is currently waiting for the user. */
export function isNameDialogOpen(): boolean {
  return resolveOpenDialog !== null;
}

interface NameDialogOptions {
  title?: string;
  confirmLabel?: string;
}

/** Opens the dialog and resolves with the entered text, or `null` when cancelled. */
export function askForName(defaultValue: string, { title = "Name", confirmLabel = "OK" }: NameDialogOptions = {}): Promise<string | null> {
  if (resolveOpenDialog) resolveOpenDialog(null);
  return new Promise((resolve) => {
    resolveOpenDialog = resolve;
    modalTitle.textContent = title;
    confirmButton.textContent = confirmLabel;
    modalInput.value = defaultValue || "";
    modal.hidden = false;
    modalInput.focus();
    modalInput.select();
  });
}

function closeDialog(result: string | null): void {
  if (!resolveOpenDialog) return;
  const resolve = resolveOpenDialog;
  resolveOpenDialog = null;
  modal.hidden = true;
  resolve(result);
}

export function bindNameDialog(): void {
  confirmButton.onclick = () => closeDialog(modalInput.value);
  cancelButton.onclick = () => closeDialog(null);
  modal.addEventListener("click", (event) => { if (event.target === modal) closeDialog(null); });
  modalInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") { event.preventDefault(); closeDialog(modalInput.value); }
    else if (event.key === "Escape") { event.preventDefault(); closeDialog(null); }
  });
}
