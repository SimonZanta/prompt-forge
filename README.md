# Prompt Forge

Minimal local editor for XML-structured AI prompts. Bun + SQLite, no dependencies.

## Run

```sh
bun run dev        # http://localhost:4177, hot-reloads on server changes
bun start          # plain run
PORT=4000 bun start
```

Prompts are stored in `prompts.db` next to `server.ts`.

## Editor

- `<` opens tag suggestions (defaults + every tag you've used in any prompt); Enter/Tab accepts
- typing `>` after `<tag` auto-inserts `</tag>` and puts the cursor between
- typing `</` completes the nearest open tag and dedents it one level on its own line
- Enter indents to the current level, one deeper after an opening tag; between `<tag>` and `</tag>` it expands an indented block; Shift+Enter is a plain newline
- lines auto-wrap at column 100 while typing, the continuation keeps the line's indentation (off inside code contexts)
- with a selection: `"` `'` `(` `[` `{` `` ` `` `*` `_` wrap it instead of replacing; Tab / Shift+Tab indent / dedent the selected lines
- Ctrl+B / Ctrl+I / Ctrl+E wrap selection in `**bold**` / `*italic*` / `` `code` ``; ```` ```lang ```` fenced code blocks are highlighted too
- `+` in the sidebar offers templates (blank, tasks, summarization, general skeleton)
- copy icon (top right) copies the whole XML to the clipboard
- autosaves 500 ms after you stop typing; Ctrl+S saves immediately
