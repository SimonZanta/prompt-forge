import { resolve } from "path";
import editorPage from "./client/editor/index.html";
import settingsPage from "./client/settings/index.html";
import { openDatabase } from "./db/database.ts";
import { createPromptRoutes } from "./prompts/index.ts";
import { createBlockRoutes } from "./blocks/index.ts";
import { createTagRoutes } from "./tags/index.ts";
import { errorResponse } from "./http/index.ts";

/** The database lives in the project root (one level above `src/`). */
const DATABASE_PATH = resolve(import.meta.dir, "..", "prompts.db");

const db = openDatabase(DATABASE_PATH);

const server = Bun.serve({
  port: Number(process.env.PORT) || 4177,
  // Bundles the HTML pages' <script> / <link> assets (TypeScript, CSS) on the fly.
  development: process.env.NODE_ENV !== "production",
  routes: {
    "/": editorPage,
    "/index.html": editorPage,
    "/settings": settingsPage,
    "/settings.html": settingsPage,
    ...createPromptRoutes(db),
    ...createBlockRoutes(db),
    ...createTagRoutes(db),
  },
  fetch() {
    return errorResponse("not found", 404);
  },
});

console.log(`prompt-forge running at http://localhost:${server.port}`);
