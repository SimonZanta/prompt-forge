import type { Tag } from "../../tags/index.ts";
import { apiRequest } from "../shared/api.ts";
import { editorState } from "./state.ts";

/** Fetches the permanent tag names from settings; keeps the previous list if the request fails. */
export async function loadPermanentTags(): Promise<void> {
  try {
    const tags = await apiRequest<Tag[]>("/tags");
    if (Array.isArray(tags)) editorState.permanentTagNames = tags.map((tag) => tag.name);
  } catch { /* keep previous list */ }
}
