# Prompt Forge

Minimal editor for XML-structured AI prompts. Runs entirely in the browser — a static site with no
backend, no database and no runtime dependencies. Prompts live in the browser or, in Chrome / Edge, in a
folder on your disk that you pick.

## Run

```sh
bun install        # dev-only: TypeScript + Bun types
bun run dev        # http://localhost:4177, dev server that bundles TS / CSS on the fly with hot reload
PORT=4000 bun run dev
bun run build      # static site in dist/ (index.html + hashed js/css) — host it anywhere
bun test           # unit tests (storage validation + pure editor logic)
bun run typecheck  # tsc --noEmit
```

`dist/` uses relative asset paths, so it works from a sub-path too (GitHub Pages, Cloudflare Pages, any
static host). The File System Access API needs HTTPS or localhost, which every static host provides.

## Project layout

```
src/
  index.html             the single page (editor + settings) and build entry point
  dev-server.ts          Bun.serve for development only (serves the page, bundles on the fly)
  storage/
    prompt-store.ts          PromptStore interface + name validation / duplicate checks shared by both backends
    browser-prompt-store.ts  prompts in IndexedDB (default, works in every browser)
    folder-prompt-store.ts   prompts as <folder>/<name>.xml files via the File System Access API
    directory-handle.ts      folder picker, permission checks, remembering the handle in IndexedDB
    active-prompt-store.ts   which backend is active, switching, copying browser prompts into a folder
    settings-store.ts        blocks + tags as one JSON document in localStorage
    ui-state-store.ts        rail width + accent colour as a second JSON document in localStorage
    idb.ts                   tiny promise wrapper over IndexedDB
    *-validation.ts, *-defaults.ts, prompt-store.test.ts
  Folders nest: a folder is addressed by its path (`default/archive`); on disk that is a nested directory,
  in IndexedDB a row keyed by the path. Deleting a folder is only allowed when it is completely empty.
  shared/                theme.css (design tokens, accent tints derived in CSS), base.css, accent.ts, dom.ts, theme.ts
  editor/                editor.css + main.ts; one module per concern
                         node-tree (model + XML), block-editor, insert-menu, view-toggle, prompt-canvas,
                         folder-tree + library + folder-actions + prompt-actions (rail), tooltip, rail-resize,
                         XML view: xml-context, syntax-highlight, suggestions, key-handlers, autosave, ...
                         settings-pane (custom blocks, tags, accent — shown in place of the editor)
```

`bun build` bundles the `.ts` / `.css` referenced by `index.html` into `dist/`; the dev server does the same in memory.

## Editor

Two views of the same prompt, switched with the Blocks / XML toggle in the header.

**Blocks** (default) — every XML element is a block: a monospace tag chip, editable text, nested children
behind a hairline guide. Root-level chips take the accent colour.
- `/` (or the insert row at the bottom, or `+` on a block) opens the insert menu: custom blocks and tags from
  settings plus tags already used in the prompt; type to filter, arrows + Enter insert, Escape closes, an
  unmatched name creates that tag. Inserted blocks are copies, so inserting a block twice gives independent trees.
- typing `[[` in a text field opens the same menu to link another block as `[[tag]]`
- the chevron collapses a block to one line (a preview of its text or its child count); leaves show a word count
- hover or focus a block for its controls: drag grip (reorders among siblings), add child, delete;
  Ctrl+Z outside a text field restores the last deleted block to where it was
- text edits never rebuild the tree, so the caret stays put; structural changes do

**XML** — the raw file, with everything the old editor had:
- `<` opens tag suggestions (defaults + every tag you've used in any prompt); Enter/Tab accepts
- typing `>` after `<tag` auto-inserts `</tag>` and puts the cursor between
- typing `</` completes the nearest open tag and dedents it one level on its own line
- Enter indents to the current level, one deeper after an opening tag; between `<tag>` and `</tag>` it expands an indented block; Shift+Enter is a plain newline
- lines auto-wrap at column 100 while typing, the continuation keeps the line's indentation (off inside code contexts)
- with a selection: `"` `'` `(` `[` `{` `` ` `` `*` `_` wrap it instead of replacing; Tab / Shift+Tab indent / dedent the selected lines
- Ctrl+B / Ctrl+I / Ctrl+E wrap selection in `**bold**` / `*italic*` / `` `code` ``; ```` ```lang ```` fenced code blocks are highlighted too
- renaming an opening tag renames its closing tag (and vice versa)
- copy icon (top right) copies the whole XML to the clipboard
- autosaves 500 ms after you stop typing; Ctrl+S saves immediately

## Rail

The right-hand rail is a folder tree: folders expand in place, nest to any depth and show how many prompts sit
beneath them; the open prompt is highlighted and its folder path appears as a chip in the header.
- hover or focus a folder for its actions: new subfolder, rename, delete (only when it holds nothing at all,
  so nothing can be orphaned); prompts get rename and delete
- new folders open straight into an inline rename field — Enter commits, Escape cancels, clicking away commits;
  a rejected name (duplicate, unsafe characters) stays in the field marked red
- `New prompt` at the end of a folder creates `Untitled` there and puts the caret in the title to name it
- search filters prompts at every depth and expands the folders on the way to each match; Escape clears
- keyboard: arrows move between rows, Left / Right collapse and expand, Enter or Space activates
- the handle on the rail's inner edge resizes it (150–420 px, double-click or Home resets, arrow keys nudge);
  the width is remembered
- hovering or focusing a row for a moment shows its full name and the folder path it sits in

## Settings

The gear in the rail foot opens settings in place of the editor (the header swaps to a back arrow).
- **Custom blocks** — each definition has a name (the command shown in the `/` menu) and a body edited either as
  blocks, with the same editor as the canvas (nesting, `/` insertion, drag to reorder), or as XML. A definition
  may hold several top-level elements. The footer shows what the block inserts; XML that does not parse is
  marked and the last valid definition is kept until it does.
- **Tags** — the permanent tags the insert menu always offers; add with Enter, remove with the ×.
- **Accent** — six presets or any six-digit hex; the two tints (chip fill, readable text colour) are derived per
  theme, so any colour stays legible in dark and light. Reset returns to Cobalt.

## Storage

Everything is stored on the user's side; the app has no server.

- **Browser storage (default).** On first visit prompts live in the browser's IndexedDB, seeded with a
  `default` folder and an example prompt. Works in every browser, nothing to set up.
- **On disk a prompt is its XML string**, in both backends — the block tree is derived from it on open and
  re-serialized on every edit (two-space indent, text trimmed, `<` / `&` in text as entities; comments and
  processing instructions are not kept). A file that is not well-formed XML opens in the XML view only. Files
  from the old free-text editor that used `` `<tag>` `` to refer to a block are rewritten once on first open:
  those references become `[[tag]]` links and `<` / `&` inside code are escaped.
- **Folder on disk (Chrome, Edge, Opera on desktop).** The `Open folder…` link at the bottom of the sidebar
  lets you pick a directory; from then on prompts are read from and written to
  `<picked folder>/<folder>/…/<name>.xml` — directories are folders (nested as deep as you like), `.xml` files
  are prompts, other files are ignored but kept. The chosen folder is remembered across reloads (the browser may ask for one confirmation
  click, shown as `Reconnect`). When you switch, the app offers to copy your browser-stored prompts into
  the folder. `Use browser storage` detaches the folder again; the files stay on disk.
  Firefox, Safari and mobile browsers lack the folder picker, so they always use browser storage.
- **Settings** (custom blocks, permanent tags) are one JSON document under the `settings` key in
  `localStorage`, seeded with defaults on first load. They belong to the browser, not to a prompt folder: opening
  the same folder on another computer gives you that computer's blocks and tags. There is deliberately no sync.
- **UI state** (rail width, accent colour) is a second JSON document under the `ui` key; the theme keeps
  its own `theme` key. Both are read by the inline script in `<head>` so the page paints correctly at once.

Clearing site data in the browser resets everything to the defaults. A `prompts/` folder from the old
server-based version already has the right layout — just open it.

## Settings

`settings.html` holds **custom blocks** (a command like `<my-custom-command>` that expands to an XML
snippet) and the **permanent tags** offered by the editor's `<` autocomplete. Tags written inside a prompt
are suggested only within that prompt.
