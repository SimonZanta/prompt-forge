/** An XML tag name: starts with a letter or `_`, then letters, digits, `_`, `.`, `:`, `-`. Shared by server and client. */
export const TAG_NAME_PATTERN = /^[A-Za-z_][\w.:-]*$/;

export function isValidTagName(name: string): boolean {
  return TAG_NAME_PATTERN.test(name);
}
