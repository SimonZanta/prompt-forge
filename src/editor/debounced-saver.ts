/** Debounced per-item autosave that reports progress into a status element (`●` pending, `!` error). */
export interface DebouncedSaver {
  /** Schedules `save` for `itemKey`, replacing any save already pending for the same item. */
  schedule(itemKey: number | string, save: () => Promise<void>): void;
  /** Runs every pending save immediately (used on page unload). */
  flush(): Promise<void>;
}

export function createDebouncedSaver(statusElement: HTMLElement, delayMs = 500): DebouncedSaver {
  const pendingSaves = new Map<number | string, { timer: ReturnType<typeof setTimeout>; save: () => Promise<void> }>();

  function clearStatusWhenIdle(): void {
    if (!pendingSaves.size) {
      statusElement.textContent = "";
      statusElement.title = "";
    }
  }

  async function runSave(itemKey: number | string, save: () => Promise<void>): Promise<void> {
    pendingSaves.delete(itemKey);
    try {
      await save();
    } catch (error) {
      statusElement.textContent = "!";
      statusElement.title = error instanceof Error ? error.message : String(error);
      return;
    }
    clearStatusWhenIdle();
  }

  return {
    schedule(itemKey, save) {
      statusElement.textContent = "●";
      const existing = pendingSaves.get(itemKey);
      if (existing) clearTimeout(existing.timer);
      const timer = setTimeout(() => runSave(itemKey, save), delayMs);
      pendingSaves.set(itemKey, { timer, save });
    },
    async flush() {
      const saves = [...pendingSaves.entries()];
      for (const [, pending] of saves) clearTimeout(pending.timer);
      await Promise.all(saves.map(([itemKey, pending]) => runSave(itemKey, pending.save)));
    },
  };
}
