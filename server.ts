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

const json = (data: unknown, status = 200) =>
  Response.json(data, { status });

const server = Bun.serve({
  port: Number(process.env.PORT) || 4177,
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/" || url.pathname === "/index.html") {
      return new Response(Bun.file(join(import.meta.dir, "public", "index.html")));
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
