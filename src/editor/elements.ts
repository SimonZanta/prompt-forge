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
export const folderChip = queryElement<HTMLSpanElement>("#folder-chip");
export const saveStatusIndicator = queryElement<HTMLSpanElement>("#status");
export const copyButton = queryElement<HTMLButtonElement>("#copy");
export const railGrip = queryElement<HTMLDivElement>("#rail-grip");
export const searchInput = queryElement<HTMLInputElement>("#search");
export const newFolderButton = queryElement<HTMLButtonElement>("#new-folder");
export const treeElement = queryElement<HTMLDivElement>("#tree");
export const tooltipElement = queryElement<HTMLDivElement>("#tip");
export const themeToggleButton = queryElement<HTMLButtonElement>("#theme");
export const storageLabel = queryElement<HTMLSpanElement>("#storage-label");
export const storageOpenFolderButton = queryElement<HTMLButtonElement>("#storage-open");
export const storageReconnectButton = queryElement<HTMLButtonElement>("#storage-reconnect");
export const storageUseBrowserButton = queryElement<HTMLButtonElement>("#storage-browser");
export const storageUnsupportedNote = queryElement<HTMLDivElement>("#storage-note");
