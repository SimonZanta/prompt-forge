import { collectTags, findPartnerTag, isInsideCodeContext } from "./xml-context.ts";

/** Pure logic behind "rename an opening tag and its closing tag follows" (and vice versa). */

export interface ChangedRange {
  start: number;
  removedCount: number;
  insertedCount: number;
}

export interface EditedTagName {
  nameStart: number;
  nameEnd: number;
  name: string;
  isClosing: boolean;
}

export interface PartnerRename {
  start: number;
  end: number;
  name: string;
}

const NAME_CHAR_PATTERN = /[\w.:-]/;

/** The single contiguous region that differs between two versions of the text, or `null` if equal. */
export function findChangedRange(oldValue: string, newValue: string): ChangedRange | null {
  if (oldValue === newValue) return null;
  let start = 0;
  const shorter = Math.min(oldValue.length, newValue.length);
  while (start < shorter && oldValue[start] === newValue[start]) start++;
  let oldEnd = oldValue.length;
  let newEnd = newValue.length;
  while (oldEnd > start && newEnd > start && oldValue[oldEnd - 1] === newValue[newEnd - 1]) {
    oldEnd--;
    newEnd--;
  }
  return { start, removedCount: oldEnd - start, insertedCount: newEnd - start };
}

/** If the edit at `changeStart` happened inside a tag name (`<name` or `</name`), describes that name. */
export function findEditedTagName(newValue: string, changeStart: number, insertedCount: number): EditedTagName | null {
  let nameStart = changeStart;
  while (nameStart > 0 && NAME_CHAR_PATTERN.test(newValue[nameStart - 1])) nameStart--;

  let isClosing: boolean;
  if (newValue[nameStart - 1] === "<") isClosing = false;
  else if (newValue[nameStart - 1] === "/" && newValue[nameStart - 2] === "<") isClosing = true;
  else return null;

  let nameEnd = changeStart + insertedCount;
  while (nameEnd < newValue.length && NAME_CHAR_PATTERN.test(newValue[nameEnd])) nameEnd++;

  const name = newValue.slice(nameStart, nameEnd);
  if (name && !/^[A-Za-z_]/.test(name)) return null;
  return { nameStart, nameEnd, name, isClosing };
}

/**
 * Given the editor text before and after one edit, finds the partner tag whose name must be
 * updated to keep the pair in sync. Returns `null` when the edit was not a tag rename.
 */
export function computePartnerRename(oldValue: string, newValue: string): PartnerRename | null {
  const change = findChangedRange(oldValue, newValue);
  if (!change) return null;
  const insertedText = newValue.slice(change.start, change.start + change.insertedCount);
  const removedText = oldValue.slice(change.start, change.start + change.removedCount);
  if (!/^[\w.:-]*$/.test(insertedText) || !/^[\w.:-]*$/.test(removedText)) return null;

  const edited = findEditedTagName(newValue, change.start, change.insertedCount);
  if (!edited) return null;
  if (isInsideCodeContext(newValue.slice(0, edited.nameStart))) return null;

  // the old name occupied [nameStart, oldNameEnd) in the previous text
  let oldNameEnd = edited.nameStart;
  while (oldNameEnd < oldValue.length && NAME_CHAR_PATTERN.test(oldValue[oldNameEnd])) oldNameEnd++;
  if (change.start + change.removedCount > oldNameEnd) return null;
  const oldName = oldValue.slice(edited.nameStart, oldNameEnd);
  if (oldName === edited.name) return null;

  const tags = collectTags(oldValue);
  const editedIndex = tags.findIndex((tag) => tag.nameStart === edited.nameStart && tag.isClosing === edited.isClosing);
  if (editedIndex < 0 || tags[editedIndex].name !== oldName || tags[editedIndex].isSelfClosing) return null;
  const partner = findPartnerTag(tags, editedIndex);
  if (!partner) return null;

  // shift the partner's position if it lies after the edit
  const lengthDelta = change.insertedCount - change.removedCount;
  const partnerStart = partner.nameStart + (partner.nameStart > change.start ? lengthDelta : 0);
  const prefix = partner.isClosing ? "</" : "<";
  if (partnerStart < prefix.length) return null;
  if (newValue.slice(partnerStart - prefix.length, partnerStart) !== prefix) return null;
  if (newValue.slice(partnerStart, partnerStart + oldName.length) !== oldName) return null;
  const charAfter = newValue[partnerStart + oldName.length];
  if (charAfter !== undefined && NAME_CHAR_PATTERN.test(charAfter)) return null;

  return { start: partnerStart, end: partnerStart + oldName.length, name: edited.name };
}
