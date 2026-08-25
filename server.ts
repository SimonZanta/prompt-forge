import { Database } from "bun:sqlite";
import { join } from "path";

const db = new Database(join(import.meta.dir, "prompts.db"));

db.run(`
  CREATE TABLE IF NOT EXISTS prompts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL DEFAULT 'Untitled',
    content TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS blocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    command TEXT NOT NULL UNIQUE,
    content TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

const COMMAND_RE = /^[A-Za-z_][\w.-]*$/;
const TAG_RE = /^[A-Za-z_][\w.:-]*$/;

const DEFAULT_TAGS = [
  "instruction", "context", "task", "task_description", "additional_context", "role", "rules", "constraints",
  "example", "examples", "input", "output", "output_format", "expected_output_format",
  "text_to_summarize", "generated_summary", "code_block", "thinking", "format", "data", "document",
  "question", "answer", "system", "user",
];

const tagCount = (db.query("SELECT COUNT(*) AS c FROM tags").get() as { c: number }).c;
if (tagCount === 0) {
  const ins = db.query("INSERT OR IGNORE INTO tags (name) VALUES (?)");
  for (const t of DEFAULT_TAGS) ins.run(t);
}

const TEMPLATE = `<prompt_summary>
  <instruction>
    Summarize the text provided in the \`<text_to_summarize>\` tag in a single concise paragraph,
    focusing on the main challenges and solutions presented. The answer should be placed
    within the \`<generated_summary>\` tag.
  </instruction>
  <text_to_summarize>
    The rapid expansion of generative artificial intelligence presents a unique set of ethical challenges,
    including the potential for misinformation, the perpetuation of biases present in training data,
    and issues related to intellectual property.
  </text_to_summarize>
  <expected_output_format>
    <generated_summary>[A concise paragraph here]</generated_summary>
  </expected_output_format>
</prompt_summary>
`;

const count = (db.query("SELECT COUNT(*) AS c FROM prompts").get() as { c: number }).c;
if (count === 0) {
  db.run("INSERT INTO prompts (title, content) VALUES (?, ?)", ["Summary prompt (example)", TEMPLATE]);
}

const EXAMPLE_BLOCK = `<task>
  <task_description></task_description>
  <example></example>
</task>`;
const blockCount = (db.query("SELECT COUNT(*) AS c FROM blocks").get() as { c: number }).c;
if (blockCount === 0) {
  db.run("INSERT INTO blocks (command, content) VALUES (?, ?)", ["my-custom-command", EXAMPLE_BLOCK]);
}

const json = (data: unknown, status = 200) =>
  Response.json(data, { status });

const server = Bun.serve({
  port: Number(process.env.PORT) || 4177,
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/" || url.pathname === "/index.html") {
      return new Response(Bun.file(join(import.meta.dir, "public", "index.html")));
    }
    if (url.pathname === "/settings" || url.pathname === "/settings.html") {
      return new Response(Bun.file(join(import.meta.dir, "public", "settings.html")));
    }

    /* ---------- blocks ---------- */
    if (url.pathname === "/api/blocks") {
      if (req.method === "GET") {
        return json(db.query("SELECT * FROM blocks ORDER BY command ASC").all());
      }
      if (req.method === "POST") {
        const body = await req.json().catch(() => ({}));
        const command = String(body.command ?? "");
        if (!COMMAND_RE.test(command)) return json({ error: "invalid command" }, 400);
        if (db.query("SELECT id FROM blocks WHERE command = ?").get(command)) return json({ error: "duplicate command" }, 409);
        const row = db
          .query("INSERT INTO blocks (command, content) VALUES (?, ?) RETURNING *")
          .get(command, String(body.content ?? ""));
        return json(row, 201);
      }
    }

    const bm = url.pathname.match(/^\/api\/blocks\/(\d+)$/);
    if (bm) {
      const id = Number(bm[1]);
      const existing = db.query("SELECT * FROM blocks WHERE id = ?").get(id) as Record<string, unknown> | null;
      if (!existing) return json({ error: "not found" }, 404);

      if (req.method === "PUT") {
        const body = await req.json().catch(() => ({}));
        const command = body.command === undefined ? String(existing.command) : String(body.command);
        if (!COMMAND_RE.test(command)) return json({ error: "invalid command" }, 400);
        const dup = db.query("SELECT id FROM blocks WHERE command = ? AND id != ?").get(command, id);
        if (dup) return json({ error: "duplicate command" }, 409);
        const content = body.content === undefined ? String(existing.content) : String(body.content);
        const row = db
          .query("UPDATE blocks SET command = ?, content = ?, updated_at = datetime('now') WHERE id = ? RETURNING *")
          .get(command, content, id);
        return json(row);
      }
      if (req.method === "DELETE") {
        db.run("DELETE FROM blocks WHERE id = ?", [id]);
        return json({ ok: true });
      }
    }

    /* ---------- tags ---------- */
    if (url.pathname === "/api/tags") {
      if (req.method === "GET") {
        return json(db.query("SELECT * FROM tags ORDER BY name ASC").all());
      }
      if (req.method === "POST") {
        const body = await req.json().catch(() => ({}));
        const name = String(body.name ?? "");
        if (!TAG_RE.test(name)) return json({ error: "invalid tag" }, 400);
        if (db.query("SELECT id FROM tags WHERE name = ?").get(name)) return json({ error: "duplicate tag" }, 409);
        const row = db.query("INSERT INTO tags (name) VALUES (?) RETURNING *").get(name);
        return json(row, 201);
      }
    }

    const tm = url.pathname.match(/^\/api\/tags\/(\d+)$/);
    if (tm) {
      const id = Number(tm[1]);
      const existing = db.query("SELECT * FROM tags WHERE id = ?").get(id) as Record<string, unknown> | null;
      if (!existing) return json({ error: "not found" }, 404);

      if (req.method === "PUT") {
        const body = await req.json().catch(() => ({}));
        const name = body.name === undefined ? String(existing.name) : String(body.name);
        if (!TAG_RE.test(name)) return json({ error: "invalid tag" }, 400);
        const dup = db.query("SELECT id FROM tags WHERE name = ? AND id != ?").get(name, id);
        if (dup) return json({ error: "duplicate tag" }, 409);
        const row = db
          .query("UPDATE tags SET name = ?, updated_at = datetime('now') WHERE id = ? RETURNING *")
          .get(name, id);
        return json(row);
      }
      if (req.method === "DELETE") {
        db.run("DELETE FROM tags WHERE id = ?", [id]);
        return json({ ok: true });
      }
    }

    if (url.pathname === "/api/prompts") {
      if (req.method === "GET") {
        return json(db.query("SELECT * FROM prompts ORDER BY updated_at DESC").all());
      }
      if (req.method === "POST") {
        const body = await req.json().catch(() => ({}));
        const row = db
          .query("INSERT INTO prompts (title, content) VALUES (?, ?) RETURNING *")
          .get(body.title ?? "Untitled", body.content ?? "");
        return json(row, 201);
      }
    }

    const m = url.pathname.match(/^\/api\/prompts\/(\d+)$/);
    if (m) {
      const id = Number(m[1]);
      const existing = db.query("SELECT * FROM prompts WHERE id = ?").get(id) as Record<string, unknown> | null;
      if (!existing) return json({ error: "not found" }, 404);

      if (req.method === "PUT") {
        const body = await req.json().catch(() => ({}));
        const row = db
          .query("UPDATE prompts SET title = ?, content = ?, updated_at = datetime('now') WHERE id = ? RETURNING *")
          .get(body.title ?? existing.title, body.content ?? existing.content, id);
        return json(row);
      }
      if (req.method === "DELETE") {
        db.run("DELETE FROM prompts WHERE id = ?", [id]);
        return json({ ok: true });
      }
    }

    return json({ error: "not found" }, 404);
  },
});

console.log(`prompt-forge running at http://localhost:${server.port}`);
