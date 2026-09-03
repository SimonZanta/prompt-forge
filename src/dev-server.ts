import editorPage from "./index.html";
import settingsPage from "./settings.html";

/**
 * Development server only: serves the two pages with Bun bundling their TypeScript / CSS on the fly.
 * Production is the static `dist/` produced by `bun run build`; there is no backend anymore.
 */
const server = Bun.serve({
  port: Number(process.env.PORT) || 4177,
  development: true,
  routes: {
    "/": editorPage,
    "/index.html": editorPage,
    "/settings": settingsPage,
    "/settings.html": settingsPage,
  },
});

console.log(`prompt-forge dev server at http://localhost:${server.port}`);
