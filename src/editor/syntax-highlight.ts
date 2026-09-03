/** Pure functions that turn prompt source into the HTML shown in the highlight layer. */

export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * One alternation per token type, matched against already-escaped text:
 * fenced code block | xml tag | [[link]] | **bold** | *italic* | `code` | # heading
 */
const HIGHLIGHT_TOKEN_PATTERN =
  /(^[ \t]*```[^\n]*(?:\n(?:[\s\S]*?\n[ \t]*```[ \t]*$|[\s\S]*$))?)|(&lt;\/?[A-Za-z_][\w.:-]*[\s\S]*?&gt;)|(\[\[[A-Za-z_][\w.:-]*\]\])|(\*\*[^*\n]+\*\*)|(\*[^*\n]+\*)|(`[^`\n]+`)|(^#{1,6} [^\n]*)/gm;

/** Stable colour class for a tag name (`tg tg-0` … `tg tg-9`), so the same tag always gets the same colour. */
export function tagColorClass(tagName: string): string {
  let hash = 0;
  for (let i = 0; i < tagName.length; i++) hash = (hash * 101 + tagName.charCodeAt(i)) >>> 0;
  return "tg tg-" + (hash % 10);
}

function highlightFence(fence: string): string {
  const styled = fence
    .replace(/^([ \t]*```[^\n]*)/, '<span class="md-f">$1</span>')
    .replace(/\n([ \t]*```[ \t]*)$/, '\n<span class="md-f">$1</span>');
  return '<span class="md-cb">' + styled + "</span>";
}

function highlightTag(escapedTag: string): string {
  return escapedTag.replace(/^(&lt;\/?)([\w.:-]+)([\s\S]*?)(\/?&gt;)$/, (_, open, name, attributes, close) => {
    const styledAttributes = attributes.replace(/([A-Za-z_][\w-]*)(=)/g, '<span class="at">$1</span>$2');
    return (
      '<span class="pu">' + open + "</span>" +
      '<span class="' + tagColorClass(name) + '">' + name + "</span>" +
      styledAttributes +
      '<span class="pu">' + close + "</span>"
    );
  });
}

/** Converts raw prompt source to highlighted HTML (tags, attributes and light markdown). */
export function highlightSource(source: string): string {
  return escapeHtml(source).replace(HIGHLIGHT_TOKEN_PATTERN, (_, fence, tag, link, bold, italic, code, heading) => {
    if (fence) return highlightFence(fence);
    if (tag) return highlightTag(tag);
    if (link) return '<span class="lk">' + link + "</span>";
    if (bold) return '<span class="md-b">' + bold + "</span>";
    if (italic) return '<span class="md-i">' + italic + "</span>";
    if (code) return '<span class="md-c">' + code + "</span>";
    return '<span class="md-h">' + heading + "</span>";
  });
}
