import { queryElement } from "../shared/dom.ts";

/** DOM references used across the editor modules. */
export const editorTextarea = queryElement<HTMLTextAreaElement>("#editor");
export const highlightLayer = queryElement<HTMLPreElement>("#highlight");
export const highlightCode = queryElement<HTMLElement>("#hl");
export const editorWrap = queryElement<HTMLDivElement>(".editor-wrap");
export const suggestionBox = queryElement<HTMLDivElement>("#suggest");
export const canvasElement = queryElement<HTMLDivElement>("#canvas");
export const xmlWrap = queryElement<HTMLDivElement>("#xmlwrap");
export const xmlNote = queryElement<HTMLParagraphElement>("#xml-note");
export const viewBlocksButton = queryElement<HTMLButtonElement>("#view-blocks");
export const viewXmlButton = queryElement<HTMLButtonElement>("#view-xml");
export const titleInput = queryElement<HTMLInputElement>("#title");
export const saveStatusIndicator = queryElement<HTMLSpanElement>("#status");
export const sidebarElement = queryElement<HTMLElement>("#sidebar");
export const folderListElement = queryElement<HTMLUListElement>("#folder-list");
export const folderNameLabel = queryElement<HTMLSpanElement>("#folder-name");
export const newFolderButton = queryElement<HTMLButtonElement>("#new-folder");
export const backToFoldersButton = queryElement<HTMLButtonElement>("#back");
export const promptListElement = queryElement<HTMLUListElement>("#list");
export const newPromptButton = queryElement<HTMLButtonElement>("#new");
export const copyButton = queryElement<HTMLButtonElement>("#copy");
export const themeToggleButton = queryElement<HTMLButtonElement>("#theme");
export const storageLabel = queryElement<HTMLSpanElement>("#storage-label");
export const storageOpenFolderButton = queryElement<HTMLButtonElement>("#storage-open");
export const storageReconnectButton = queryElement<HTMLButtonElement>("#storage-reconnect");
export const storageUseBrowserButton = queryElement<HTMLButtonElement>("#storage-browser");
export const storageUnsupportedNote = queryElement<HTMLDivElement>("#storage-note");
