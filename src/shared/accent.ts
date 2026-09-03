import { DEFAULT_ACCENT, loadUiState, normalizeHex, saveUiState } from "../storage/ui-state-store.ts";

/**
 * The accent colour. Only `--accent` is ever set from here; `--accent-soft` and `--accent-text` are
 * derived from it in theme.css (relative colour syntax, per theme), so a theme flip needs no JS.
 * The inline script in <head> applies the stored value before first paint; this module owns changes.
 */

export interface AccentPreset {
  name: string;
  hex: string;
}

/** Adding a preset is one line here; the settings page renders whatever is in the list. */
export const ACCENT_PRESETS: AccentPreset[] = [
  { name: "Cobalt", hex: "#4C8DF5" },
  { name: "Teal", hex: "#28A48A" },
  { name: "Moss", hex: "#6C9A3F" },
  { name: "Amber", hex: "#C98A26" },
  { name: "Violet", hex: "#8C7BF0" },
  { name: "Clay", hex: "#CC6A4E" },
];

export { DEFAULT_ACCENT, normalizeHex };

export function currentAccent(): string {
  return loadUiState().accent;
}

/** Applies and remembers a colour; returns the normalized hex, or null when `input` is not a six-digit hex. */
export function applyAccent(input: string): string | null {
  const hex = normalizeHex(input);
  if (!hex) return null;
  document.documentElement.style.setProperty("--accent", hex);
  saveUiState({ accent: hex });
  return hex;
}

export function resetAccent(): string {
  return applyAccent(DEFAULT_ACCENT)!;
}

/** Idempotent re-application of the stored colour (the head script already did it before paint). */
export function applyStoredAccent(): void {
  document.documentElement.style.setProperty("--accent", currentAccent());
}
