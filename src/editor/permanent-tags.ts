import { loadSettings } from "../storage/settings-store.ts";
import { editorState } from "./state.ts";

/** Reads the permanent tag names from settings (localStorage). */
export function loadPermanentTags(): void {
  editorState.permanentTagNames = loadSettings().tags;
}
