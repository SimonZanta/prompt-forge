/**
 * One-time repair of prompt files written with the old free-text editor, which treated backtick
 * spans as "not XML". The block composer needs real XML, so on first open a file that fails to
 * parse is rewritten (and saved) with:
 *   - `<tag>` in backticks turned into the link syntax `[[tag]]` — the way to refer to another
 *     block from text;
 *   - `<` and `&` inside other code spans and fences, `<` that cannot start a tag, and bare `&`
 *     escaped as entities — lossless, the parsed text is identical.
 * A file that still does not parse afterwards opens in the XML view only.
 */

export const TAG_LINK_PATTERN = /\[\[([A-Za-z_][\w.:-]*)\]\]/g;

function escapeCode(code: string): string {
  return code.replace(/&(?![a-zA-Z]+;|#\d+;)/g, "&amp;").replace(/</g, "&lt;");
}

export function migrateLegacyXml(text: string): string {
  return text
    .replace(/^[ \t]*```[^\n]*\n[\s\S]*?\n[ \t]*```[ \t]*$/gm, escapeCode)
    .replace(/`<([A-Za-z_][\w.:-]*)>`/g, "[[$1]]")
    .replace(/`[^`\n]*`/g, escapeCode)
    .replace(/<(?![A-Za-z_/!?])/g, "&lt;")
    .replace(/&(?![a-zA-Z]+;|#\d+;)/g, "&amp;");
}

/** True when the rewrite would change `text` at all (cheap pre-check before parsing twice). */
export function legacyRewriteNeeded(text: string): boolean {
  return migrateLegacyXml(text) !== text;
}
