/**
 * UI state — things about the window, not about the prompts: rail width and accent colour.
 * One JSON document under `localStorage.ui`, separate from `settings` (user configuration: blocks,
 * tags) and from prompt data. The theme keeps its own `theme` key because the inline <head> script
 * reads it before anything else loads.
 */

export interface UiState {
  version: 1;
  /** Width of the right-hand rail in px, clamped to [RAIL_MIN, RAIL_MAX]. */
  railWidth: number;
  /** Six-digit uppercase hex, e.g. "#4C8DF5". */
  accent: string;
}

export const UI_STATE_KEY = "ui";

export const RAIL_MIN = 150;
export const RAIL_MAX = 420;
export const RAIL_DEFAULT = 190;
export const DEFAULT_ACCENT = "#4C8DF5";

const HEX_PATTERN = /^#?([0-9a-f]{6})$/i;

/** "#4c8df5", "4C8DF5" → "#4C8DF5"; anything else → null. */
export function normalizeHex(input: string): string | null {
  const match = HEX_PATTERN.exec(input.trim());
  return match ? "#" + match[1].toUpperCase() : null;
}

export function clampRailWidth(width: number): number {
  return Math.max(RAIL_MIN, Math.min(RAIL_MAX, Math.round(width)));
}

export function defaultUiState(): UiState {
  return { version: 1, railWidth: RAIL_DEFAULT, accent: DEFAULT_ACCENT };
}

/** Tolerant of a hand-edited or corrupted document: each field falls back to its default on its own. */
export function parseUiState(json: string | null): UiState {
  const state = defaultUiState();
  if (!json) return state;
  try {
    const raw = JSON.parse(json) as Partial<UiState>;
    if (!raw || typeof raw !== "object") return state;
    if (typeof raw.railWidth === "number" && Number.isFinite(raw.railWidth)) state.railWidth = clampRailWidth(raw.railWidth);
    if (typeof raw.accent === "string") state.accent = normalizeHex(raw.accent) ?? state.accent;
  } catch { /* corrupted document: defaults */ }
  return state;
}

export function loadUiState(): UiState {
  let stored: string | null = null;
  try { stored = localStorage.getItem(UI_STATE_KEY); } catch { /* storage may be unavailable */ }
  return parseUiState(stored);
}

export function saveUiState(patch: Partial<Pick<UiState, "railWidth" | "accent">>): UiState {
  const next: UiState = { ...loadUiState(), ...patch, version: 1 };
  try { localStorage.setItem(UI_STATE_KEY, JSON.stringify(next)); } catch { /* storage may be unavailable */ }
  return next;
}
