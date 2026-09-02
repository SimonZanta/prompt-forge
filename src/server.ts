import { resolve } from "path";
import editorPage from "./client/editor/index.html";
import settingsPage from "./client/settings/index.html";
import { openDatabase } from "./db/database.ts";
import { createPromptRoutes, migrateLegacyPrompts } from "./prompts/index.ts";
import { createBlockRoutes } from "./blocks/index.ts";
import { createTagRoutes } from "./tags/index.ts";
import { errorResponse } from "./http/index.ts";

/** The database and the prompts folder live in the project root (one level above `src/`). */
const DATABASE_PATH = resolve(import.meta.dir, "..", "prompts.db");
const PROMPTS_DIR = resolve(import.meta.dir, "..", "prompts");

const db = openDatabase(DATABASE_PATH);
migrateLegacyPrompts(db, PROMPTS_DIR);

const server = Bun.serve({
  port: Number(process.env.PORT) || 4177,
  // Bundles the HTML pages' <script> / <link> assets (TypeScript, CSS) on the fly.
  development: process.env.NODE_ENV !== "production",
  routes: {
    "/": editorPage,
    "/index.html": editorPage,
    "/settings": settingsPage,
    "/settings.html": settingsPage,
    ...createPromptRoutes(PROMPTS_DIR),
    ...createBlockRoutes(db),
    ...createTagRoutes(db),
  },
  fetch() {
    return errorResponse("not found", 404);
  },
});

console.log(`prompt-forge running at http://localhost:${server.port}`);
