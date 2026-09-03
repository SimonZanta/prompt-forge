import { applyStoredAccent } from "../shared/accent.ts";
import { queryElement } from "../shared/dom.ts";
import { bindThemeToggle } from "../shared/theme.ts";
import { bindBlocksSection, loadBlocks } from "./blocks-section.ts";
import { bindTagsSection, loadTags } from "./tags-section.ts";

function startSettingsPage(): void {
  applyStoredAccent();
  bindThemeToggle(queryElement<HTMLButtonElement>("#theme"));
  bindBlocksSection();
  bindTagsSection();
  loadBlocks();
  loadTags();
}

startSettingsPage();
