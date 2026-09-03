import type { Block } from "./settings-store.ts";

/** Custom blocks seeded on a fresh install; the insert menu (`/`) offers them by command name. */
export const DEFAULT_BLOCKS: Block[] = [
  { command: "task-block", content: "<task>\n  <task_description></task_description>\n  <example></example>\n</task>" },
  { command: "rules-block", content: "<rules>\n  <rule></rule>\n  <rule></rule>\n  <rule></rule>\n</rules>" },
  { command: "context-block", content: "<context>\n  <constraints></constraints>\n</context>" },
];
