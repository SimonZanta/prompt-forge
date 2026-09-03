import { RAIL_DEFAULT, RAIL_MAX, RAIL_MIN, clampRailWidth, loadUiState, saveUiState } from "../storage/ui-state-store.ts";
import { railGrip } from "./elements.ts";
import { hideTooltip } from "./tooltip.ts";

/**
 * The drag handle on the rail's inner edge. The rail sits on the right, so dragging left widens it.
 * Width lives in `--rail`; the user's choice is remembered in UI state.
 */

const KEY_STEP = 16;

let railWidth = RAIL_DEFAULT;

function setRailWidth(px: number, persist = true): void {
  railWidth = clampRailWidth(px);
  document.documentElement.style.setProperty("--rail", railWidth + "px");
  railGrip.setAttribute("aria-valuenow", String(railWidth));
  if (persist) saveUiState({ railWidth });
}

export function bindRailResize(): void {
  railGrip.setAttribute("aria-valuemin", String(RAIL_MIN));
  railGrip.setAttribute("aria-valuemax", String(RAIL_MAX));
  setRailWidth(loadUiState().railWidth, false);

  railGrip.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    hideTooltip();
    const startX = event.clientX;
    const startWidth = railWidth;
    railGrip.classList.add("on");
    document.body.classList.add("resizing");
    const move = (moveEvent: PointerEvent) => setRailWidth(startWidth - (moveEvent.clientX - startX), false);
    const up = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      document.removeEventListener("pointercancel", up);
      railGrip.classList.remove("on");
      document.body.classList.remove("resizing");
      saveUiState({ railWidth });
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
    document.addEventListener("pointercancel", up);
  });
  railGrip.addEventListener("dblclick", () => setRailWidth(RAIL_DEFAULT));
  railGrip.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") { event.preventDefault(); setRailWidth(railWidth + KEY_STEP); }
    else if (event.key === "ArrowRight") { event.preventDefault(); setRailWidth(railWidth - KEY_STEP); }
    else if (event.key === "Home") { event.preventDefault(); setRailWidth(RAIL_DEFAULT); }
  });
}
