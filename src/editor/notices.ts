/**
 * In-app replacements for `alert` and `confirm`: a stack of toasts in the bottom-left corner of the
 * main pane and a small modal dialog. Both are keyboard-first — a toast's action button is reachable
 * with Tab, the dialog focuses its confirm button and answers Enter / Escape.
 */

export type NoticeKind = "info" | "error";

export interface NoticeOptions {
  kind?: NoticeKind;
  /** Auto-hide delay; errors default to staying longer. */
  durationMs?: number;
  /** Optional action shown as a button ("Undo"); the toast closes once it ran. */
  action?: { label: string; run(): void };
}

const INFO_MS = 3500;
const ERROR_MS = 7000;

let stack: HTMLDivElement | null = null;

function ensureStack(): HTMLDivElement {
  if (stack) return stack;
  stack = document.createElement("div");
  stack.className = "toasts";
  stack.setAttribute("role", "status");
  stack.setAttribute("aria-live", "polite");
  document.body.appendChild(stack);
  return stack;
}

/** Shows a toast; returns a function that dismisses it early. */
export function notify(message: string, options: NoticeOptions = {}): () => void {
  const kind = options.kind ?? "info";
  const toast = document.createElement("div");
  toast.className = "toast " + kind;
  const text = document.createElement("span");
  text.className = "toast-text";
  text.textContent = message;
  toast.appendChild(text);

  let timer: ReturnType<typeof setTimeout> | null = null;
  const dismiss = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    if (!toast.isConnected) return;
    toast.classList.add("out");
    setTimeout(() => toast.remove(), 150);
  };

  if (options.action) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "toast-action";
    button.textContent = options.action.label;
    button.addEventListener("click", () => { options.action!.run(); dismiss(); });
    toast.appendChild(button);
  }
  const close = document.createElement("button");
  close.type = "button";
  close.className = "toast-close";
  close.setAttribute("aria-label", "Dismiss");
  close.textContent = "×";
  close.addEventListener("click", dismiss);
  toast.appendChild(close);

  ensureStack().appendChild(toast);
  const duration = options.durationMs ?? (kind === "error" ? ERROR_MS : INFO_MS);
  timer = setTimeout(dismiss, duration);
  // hovering pauses the countdown so a message can be read (or its action reached) in peace
  toast.addEventListener("pointerenter", () => { if (timer) { clearTimeout(timer); timer = null; } });
  toast.addEventListener("pointerleave", () => { if (!timer) timer = setTimeout(dismiss, duration); });
  return dismiss;
}

export function notifyError(error: unknown): void {
  notify(error instanceof Error ? error.message : String(error), { kind: "error" });
}

export interface ConfirmOptions {
  /** Label of the confirming button, e.g. "Delete". */
  confirmLabel?: string;
  cancelLabel?: string;
  /** Styles the confirming button red. */
  danger?: boolean;
}

/** Modal yes / no question. Resolves true when confirmed; Enter confirms, Escape cancels. */
export function confirmDialog(message: string, options: ConfirmOptions = {}): Promise<boolean> {
  return new Promise((resolve) => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = document.createElement("dialog");
    dialog.className = "confirm";
    const text = document.createElement("p");
    text.className = "confirm-text";
    text.textContent = message;
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "btn";
    cancel.textContent = options.cancelLabel ?? "Cancel";
    const ok = document.createElement("button");
    ok.type = "button";
    ok.className = "btn primary" + (options.danger ? " danger" : "");
    ok.textContent = options.confirmLabel ?? "OK";
    const row = document.createElement("div");
    row.className = "confirm-actions";
    row.append(cancel, ok);
    dialog.append(text, row);
    document.body.appendChild(dialog);

    let settled = false;
    const finish = (answer: boolean) => {
      if (settled) return;
      settled = true;
      dialog.close();
      dialog.remove();
      previous?.focus();
      resolve(answer);
    };
    cancel.addEventListener("click", () => finish(false));
    ok.addEventListener("click", () => finish(true));
    dialog.addEventListener("cancel", (event) => { event.preventDefault(); finish(false); });
    dialog.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && document.activeElement !== cancel) { event.preventDefault(); finish(true); }
    });
    // a click on the backdrop (outside the dialog's box) cancels
    dialog.addEventListener("click", (event) => { if (event.target === dialog) finish(false); });
    dialog.showModal();
    ok.focus();
  });
}
