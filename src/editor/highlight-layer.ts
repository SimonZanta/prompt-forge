import { editorTextarea, highlightCode, highlightLayer } from "./elements.ts";
import { escapeHtml, highlightSource } from "./syntax-highlight.ts";
import { EDITOR_PLACEHOLDER } from "./templates.ts";

/** Re-renders the highlight layer from the textarea content (or shows the placeholder when empty). */
export function refreshHighlight(): void {
  if (!editorTextarea.value) {
    highlightCode.innerHTML = '<span class="ph">' + escapeHtml(EDITOR_PLACEHOLDER) + "</span>\n";
    return;
  }
  // trailing newline keeps the layer as tall as the textarea on the last line
  highlightCode.innerHTML = highlightSource(editorTextarea.value) + "\n";
}

/** Keeps the highlight layer scrolled exactly like the textarea so both stay aligned. */
export function syncHighlightScroll(): void {
  highlightLayer.scrollTop = editorTextarea.scrollTop;
  highlightLayer.scrollLeft = editorTextarea.scrollLeft;
}
