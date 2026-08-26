# Prompt Forge

Minimal local editor for XML-structured AI prompts. Bun + SQLite, no runtime dependencies.

## Run

```sh
bun install        # dev-only: TypeScript + Bun types
bun run dev        # http://localhost:4177, hot-reloads server and client
bun start          # plain run
PORT=4000 bun start
bun test           # unit tests (API handlers + pure editor logic)
bun run typecheck  # tsc --noEmit
```

Prompts are stored in `prompts.db` in the project root.

## Project layout

```
src/
  server.ts              entry point: opens the DB and mounts all routes in Bun.serve
  db/database.ts         opens SQLite, creates tables, seeds defaults
  http/                  JSON response / body helpers
  prompts/               } one folder per domain:
  blocks/                }   *-handlers.ts  HTTP handlers (request -> Response)
  tags/                  }   *-queries.ts   SQL + row types, *-validation.ts, *-defaults.ts
                         }   *-handlers.test.ts, index.ts (route table)
  client/
    shared/              theme.css, base.css, api.ts, dom.ts, theme.ts
    editor/              index.html + editor.css + main.ts; one module per concern
                         (xml-context, syntax-highlight, suggestions, key-handlers, autosave, ...)
    settings/            index.html + settings.css + main.ts, blocks-section.ts, tags-section.ts
```

The HTML pages are imported into `Bun.serve` routes, so Bun bundles their `.ts` and `.css` on the fly —
there is no build step. Validation patterns (`block-validation.ts`, `tag-validation.ts`) are imported by
both server and client, so the rules live in one place.

## Editor

- `<` opens tag suggestions (defaults + every tag you've used in any prompt); Enter/Tab accepts
- typing `>` after `<tag` auto-inserts `</tag>` and puts the cursor between
- typing `</` completes the nearest open tag and dedents it one level on its own line
- Enter indents to the current level, one deeper after an opening tag; between `<tag>` and `</tag>` it expands an indented block; Shift+Enter is a plain newline
- lines auto-wrap at column 100 while typing, the continuation keeps the line's indentation (off inside code contexts)
- with a selection: `"` `'` `(` `[` `{` `` ` `` `*` `_` wrap it instead of replacing; Tab / Shift+Tab indent / dedent the selected lines
- Ctrl+B / Ctrl+I / Ctrl+E wrap selection in `**bold**` / `*italic*` / `` `code` ``; ```` ```lang ```` fenced code blocks are highlighted too
- renaming an opening tag renames its closing tag (and vice versa)
- `+` in the sidebar offers templates (blank, tasks, summarization, general skeleton)
- copy icon (top right) copies the whole XML to the clipboard
- autosaves 500 ms after you stop typing; Ctrl+S saves immediately

## Database

`prompts.db` (SQLite) is created and seeded automatically on first start and is **not** tracked in git
(see `.gitignore`). To reset to a clean default state:

```sh
bun run db:reset   # deletes prompts.db; it is recreated with default data on next start
```

## Settings

`/settings` holds **custom blocks** (a command like `<my-custom-command>` that expands to an XML snippet)
and the **permanent tags** offered by the editor's `<` autocomplete. Tags written inside a prompt are
suggested only within that prompt.
