# Prompt Forge

Minimal editor for XML-structured AI prompts. Runs entirely in the browser — a static site with no
backend, no database and no runtime dependencies. Prompts live in the browser or, in Chrome / Edge, in a
folder on your disk that you pick.

## Run

```sh
bun install        # dev-only: TypeScript + Bun types
bun run dev        # http://localhost:4177, dev server that bundles TS / CSS on the fly with hot reload
PORT=4000 bun run dev
bun run build      # static site in dist/ (index.html, settings.html + hashed js/css) — host it anywhere
bun test           # unit tests (storage validation + pure editor logic)
bun run typecheck  # tsc --noEmit
```

`dist/` uses relative asset paths, so it works from a sub-path too (GitHub Pages, Cloudflare Pages, any
static host). The File System Access API needs HTTPS or localhost, which every static host provides.

## Project layout

```
src/
  index.html             editor page          } the two build entry points
  settings.html          settings page        }
  dev-server.ts          Bun.serve for development only (serves the two pages, bundles on the fly)
  storage/
    prompt-store.ts          PromptStore interface + name validation / duplicate checks shared by both backends
    browser-prompt-store.ts  prompts in IndexedDB (default, works in every browser)
    folder-prompt-store.ts   prompts as <folder>/<name>.xml files via the File System Access API
    directory-handle.ts      folder picker, permission checks, remembering the handle in IndexedDB
    active-prompt-store.ts   which backend is active, switching, copying browser prompts into a folder
    settings-store.ts        blocks + tags as one JSON document in localStorage
    idb.ts                   tiny promise wrapper over IndexedDB
    *-validation.ts, *-defaults.ts, prompt-store.test.ts
  shared/                theme.css, base.css, dom.ts, theme.ts
  editor/                editor.css + main.ts; one module per concern
                         (xml-context, syntax-highlight, suggestions, key-handlers, autosave, storage-bar, ...)
  settings/              settings.css + main.ts, blocks-section.ts, tags-section.ts
```

`bun build` bundles the `.ts` / `.css` referenced by the two HTML pages into `dist/`; the dev server does the
same in memory.

## Editor

- `<` opens tag suggestions (defaults + every tag you've used in any prompt); Enter/Tab accepts
- typing `>` after `<tag` auto-inserts `</tag>` and puts the cursor between
- typing `</` completes the nearest open tag and dedents it one level on its own line
- Enter indents to the current level, one deeper after an opening tag; between `<tag>` and `</tag>` it expands an indented block; Shift+Enter is a plain newline
- lines auto-wrap at column 100 while typing, the continuation keeps the line's indentation (off inside code contexts)
- with a selection: `"` `'` `(` `[` `{` `` ` `` `*` `_` wrap it instead of replacing; Tab / Shift+Tab indent / dedent the selected lines
- Ctrl+B / Ctrl+I / Ctrl+E wrap selection in `**bold**` / `*italic*` / `` `code` ``; ```` ```lang ```` fenced code blocks are highlighted too
- renaming an opening tag renames its closing tag (and vice versa)
- the sidebar lists folders; opening one slides in its prompt list, `‹` goes back
- `+` in the sidebar offers templates (blank, tasks, summarization, general skeleton)
- a completed `<command>…</command>` element is offered to be saved as its own prompt file in the
  current folder, then stamped with `name="…"` so it is only extracted once
- copy icon (top right) copies the whole XML to the clipboard
- autosaves 500 ms after you stop typing; Ctrl+S saves immediately

## Storage

Everything is stored on the user's side; the app has no server.

- **Browser storage (default).** On first visit prompts live in the browser's IndexedDB, seeded with a
  `default` folder and an example prompt. Works in every browser, nothing to set up.
- **Folder on disk (Chrome, Edge, Opera on desktop).** The `Open folder…` link at the bottom of the sidebar
  lets you pick a directory; from then on prompts are read from and written to
  `<picked folder>/<folder>/<name>.xml` — sub-directories are folders, `.xml` files are prompts, other files
  are ignored. The chosen folder is remembered across reloads (the browser may ask for one confirmation
  click, shown as `Reconnect`). When you switch, the app offers to copy your browser-stored prompts into
  the folder. `Use browser storage` detaches the folder again; the files stay on disk.
  Firefox, Safari and mobile browsers lack the folder picker, so they always use browser storage.
- **Settings** (custom blocks, permanent tags) are one JSON document under the `settings` key in
  `localStorage`, seeded with defaults on first load. The theme is in `localStorage` as well.

Clearing site data in the browser resets everything to the defaults. A `prompts/` folder from the old
server-based version already has the right layout — just open it.

## Settings

`settings.html` holds **custom blocks** (a command like `<my-custom-command>` that expands to an XML
snippet) and the **permanent tags** offered by the editor's `<` autocomplete. Tags written inside a prompt
are suggested only within that prompt.
