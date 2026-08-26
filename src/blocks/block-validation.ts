/** A block command: starts with a letter or `_`, then letters, digits, `_`, `.`, `-`. Shared by server and client. */
export const BLOCK_COMMAND_PATTERN = /^[A-Za-z_][\w.-]*$/;

export function isValidBlockCommand(command: string): boolean {
  return BLOCK_COMMAND_PATTERN.test(command);
}
