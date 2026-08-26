/**
 * Pure helpers that inspect the prompt text as XML: which tags are open,
 * whether a position is inside markdown code, and how tags pair up.
 */

/** A tag occurrence found by `collectTags`. */
export interface TagOccurrence {
  isClosing: boolean;
  name: string;
  isSelfClosing: boolean;
  /** Index of the first character of the tag name. */
  nameStart: number;
}

const FENCE_LINE_PATTERN = /^[ \t]*```/;

/** True when the end of `textBefore` sits inside a fenced ``` block or an inline `code` span. */
export function isInsideCodeContext(textBefore: string): boolean {
  const lines = textBefore.split("\n");
  const currentLine = lines.pop() ?? "";
  let fenceCount = 0;
  for (const line of lines) if (FENCE_LINE_PATTERN.test(line)) fenceCount++;
  if (fenceCount % 2) return true;
  if (FENCE_LINE_PATTERN.test(currentLine)) return true;
  const backtickCount = currentLine.split("`").length - 1;
  return backtickCount % 2 === 1;
}

/** Removes fenced blocks, an unterminated trailing fence and inline code so their `<...>` is not treated as XML. */
export function stripCodeSpans(text: string): string {
  return text
    .replace(/^[ \t]*```[^\n]*\n[\s\S]*?\n[ \t]*```[ \t]*$/gm, "")
    .replace(/^[ \t]*```[^\n]*[\s\S]*$/m, "")
    .replace(/`[^`\n]*`/g, "");
}

/** Names of tags opened but not yet closed in `text`, outermost first. */
export function collectOpenTagStack(text: string): string[] {
  const stack: string[] = [];
  const tagPattern = /<(\/?)([A-Za-z_][\w.:-]*)(?:[^<>]*?)(\/?)>/g;
  const xmlOnly = stripCodeSpans(text);
  let match: RegExpExecArray | null;
  while ((match = tagPattern.exec(xmlOnly))) {
    const [, closingSlash, name, selfClosingSlash] = match;
    if (selfClosingSlash) continue;
    if (closingSlash) {
      const openIndex = stack.lastIndexOf(name);
      if (openIndex >= 0) stack.length = openIndex;
    } else {
      stack.push(name);
    }
  }
  return stack;
}

/** Every tag in `text` (outside code), in document order. Tags with an empty name (`<>`) are included. */
export function collectTags(text: string): TagOccurrence[] {
  const tags: TagOccurrence[] = [];
  const tagPattern = /<(\/?)([A-Za-z_][\w.:-]*|(?=>))([^<>]*?)(\/?)>/g;
  let match: RegExpExecArray | null;
  while ((match = tagPattern.exec(text))) {
    if (isInsideCodeContext(text.slice(0, match.index))) continue;
    tags.push({
      isClosing: !!match[1],
      name: match[2],
      isSelfClosing: !!match[4],
      nameStart: match.index + 1 + match[1].length,
    });
  }
  return tags;
}

/** The closing tag matching an opening tag (or vice versa) at `tagIndex`, honouring nesting; `null` if unmatched. */
export function findPartnerTag(tags: TagOccurrence[], tagIndex: number): TagOccurrence | null {
  const tag = tags[tagIndex];
  let depth = 1;
  if (!tag.isClosing) {
    for (let i = tagIndex + 1; i < tags.length; i++) {
      const other = tags[i];
      if (other.name !== tag.name || other.isSelfClosing) continue;
      depth += other.isClosing ? -1 : 1;
      if (!depth) return other;
    }
  } else {
    for (let i = tagIndex - 1; i >= 0; i--) {
      const other = tags[i];
      if (other.name !== tag.name || other.isSelfClosing) continue;
      depth += other.isClosing ? 1 : -1;
      if (!depth) return other;
    }
  }
  return null;
}
