import { IDB_STORES, idbDelete, idbGet, idbSet } from "./idb.ts";

/**
 * File System Access API plumbing: feature detection, the folder picker, and remembering the chosen
 * directory handle in IndexedDB so it survives reloads (the browser may still ask for one confirmation
 * click before granting access again).
 */

type FileSystemPermissionMode = "read" | "readwrite";

declare global {
  interface Window {
    showDirectoryPicker?(options?: { mode?: FileSystemPermissionMode; id?: string }): Promise<FileSystemDirectoryHandle>;
  }
  interface FileSystemHandle {
    queryPermission?(descriptor: { mode: FileSystemPermissionMode }): Promise<PermissionState>;
    requestPermission?(descriptor: { mode: FileSystemPermissionMode }): Promise<PermissionState>;
  }
}

const HANDLE_KEY = "directory-handle";

/** True in Chromium browsers on desktop (Chrome, Edge, Opera); false in Firefox, Safari and on mobile. */
export function supportsFolderStorage(): boolean {
  return typeof window.showDirectoryPicker === "function";
}

/** Opens the native folder picker; `null` when the user cancels. */
export async function pickDirectory(): Promise<FileSystemDirectoryHandle | null> {
  try {
    return await window.showDirectoryPicker!({ mode: "readwrite", id: "prompt-forge-prompts" });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return null;
    throw error;
  }
}

export const saveDirectoryHandle = (handle: FileSystemDirectoryHandle) => idbSet(IDB_STORES.meta, HANDLE_KEY, handle);
export const loadDirectoryHandle = () => idbGet<FileSystemDirectoryHandle>(IDB_STORES.meta, HANDLE_KEY);
export const clearDirectoryHandle = () => idbDelete(IDB_STORES.meta, HANDLE_KEY);

/** Whether we may read and write the folder right now, without prompting the user. */
export async function hasDirectoryPermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  if (!handle.queryPermission) return true;
  return (await handle.queryPermission({ mode: "readwrite" })) === "granted";
}

/** Asks the browser for access again; must run from a user gesture (click). */
export async function requestDirectoryPermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  if (!handle.requestPermission) return true;
  return (await handle.requestPermission({ mode: "readwrite" })) === "granted";
}
