import { Database } from "bun:sqlite";
import { join } from "path";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";

const db = new Database(join(import.meta.dir, "prompts.db"));

// Legacy table, kept so old databases can be migrated to the prompts/ folder.
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
  "question", "answer", "system", "user", "command",
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

const EXAMPLE_BLOCK = `<task>
  <task_description></task_description>
  <example></example>
</task>`;
const blockCount = (db.query("SELECT COUNT(*) AS c FROM blocks").get() as { c: number }).c;
if (blockCount === 0) {
  db.run("INSERT INTO blocks (command, content) VALUES (?, ?)", ["my-custom-command", EXAMPLE_BLOCK]);
}

/* ---------- prompt files (prompts/<folder>/<name>.xml) ---------- */

const PROMPTS_DIR = join(import.meta.dir, "prompts");

// Names become directory / file names, so they must be a single safe path segment.
const NAME_MAX = 100;
function validName(name: string): boolean {
  return (
    typeof name === "string" &&
    name.length > 0 &&
    name.length <= NAME_MAX &&
    !/[/\\<>:"|?*\x00-\x1f]/.test(name) &&
    !name.startsWith(".") &&
    !/[. ]$/.test(name) &&
    name.trim() === name
  );
}
const folderPath = (folder: string) => join(PROMPTS_DIR, folder);
const promptPath = (folder: string, name: string) => join(PROMPTS_DIR, folder, name + ".xml");

function sanitizeName(raw: string): string {
  const s = raw
    .replace(/[/\\<>:"|?*\x00-\x1f]/g, "-")
    .replace(/^\.+/, "")
    .replace(/[. ]+$/, "")
    .trim()
    .slice(0, NAME_MAX);
  return s || "Untitled";
}

// One-time setup: create prompts/ and move any legacy DB prompts into prompts/default/.
if (!existsSync(PROMPTS_DIR)) {
  const defaultDir = join(PROMPTS_DIR, "default");
  mkdirSync(defaultDir, { recursive: true });
  let rows: { title: string; content: string }[] = [];
  try {
    rows = db.query("SELECT title, content FROM prompts ORDER BY updated_at ASC").all() as {
      title: string;
      content: string;
    }[];
  } catch {}
  if (rows.length === 0) rows = [{ title: "Summary prompt (example)", content: TEMPLATE }];
  const used = new Set<string>();
  for (const r of rows) {
    const base = sanitizeName(r.title || "Untitled");
    let name = base;
    let i = 2;
    while (used.has(name)) name = `${base} ${i++}`;
    used.add(name);
    writeFileSync(promptPath("default", name), r.content ?? "");
  }
}

function listFolders() {
  return readdirSync(PROMPTS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => ({
      name: d.name,
      prompt_count: readdirSync(folderPath(d.name)).filter((f) => f.endsWith(".xml")).length,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function listPrompts(folder: string) {
  return readdirSync(folderPath(folder))
    .filter((f) => f.endsWith(".xml"))
    .map((f) => {
      const name = f.slice(0, -4);
      return { name, updated_at: statSync(promptPath(folder, name)).mtime.toISOString() };
    })
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
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

    /* ---------- folders ---------- */
    if (url.pathname === "/api/folders") {
      if (req.method === "GET") {
        return json(listFolders());
      }
      if (req.method === "POST") {
        const body = await req.json().catch(() => ({}));
        const name = String(body.name ?? "");
        if (!validName(name)) return json({ error: "invalid folder name" }, 400);
        if (existsSync(folderPath(name))) return json({ error: "duplicate folder" }, 409);
        mkdirSync(folderPath(name));
        return json({ name, prompt_count: 0 }, 201);
      }
    }

    const fm = url.pathname.match(/^\/api\/folders\/([^/]+)$/);
    if (fm) {
      const folder = decodeURIComponent(fm[1]);
      if (!validName(folder)) return json({ error: "invalid folder name" }, 400);
      if (!existsSync(folderPath(folder))) return json({ error: "not found" }, 404);

      if (req.method === "PUT") {
        const body = await req.json().catch(() => ({}));
        const name = String(body.name ?? "");
        if (!validName(name)) return json({ error: "invalid folder name" }, 400);
        if (name !== folder) {
          if (existsSync(folderPath(name))) return json({ error: "duplicate folder" }, 409);
          renameSync(folderPath(folder), folderPath(name));
        }
        return json({ name });
      }
      if (req.method === "DELETE") {
        rmSync(folderPath(folder), { recursive: true, force: true });
        return json({ ok: true });
      }
    }

    /* ---------- prompts (files inside a folder) ---------- */
    const fpm = url.pathname.match(/^\/api\/folders\/([^/]+)\/prompts$/);
    if (fpm) {
      const folder = decodeURIComponent(fpm[1]);
      if (!validName(folder)) return json({ error: "invalid folder name" }, 400);
      if (!existsSync(folderPath(folder))) return json({ error: "folder not found" }, 404);

      if (req.method === "GET") {
        return json(listPrompts(folder));
      }
      if (req.method === "POST") {
        const body = await req.json().catch(() => ({}));
        const name = String(body.name ?? "");
        if (!validName(name)) return json({ error: "invalid prompt name" }, 400);
        if (existsSync(promptPath(folder, name))) return json({ error: "duplicate prompt" }, 409);
        writeFileSync(promptPath(folder, name), String(body.content ?? ""));
        return json({ name, content: String(body.content ?? "") }, 201);
      }
    }

    const fim = url.pathname.match(/^\/api\/folders\/([^/]+)\/prompts\/([^/]+)$/);
    if (fim) {
      const folder = decodeURIComponent(fim[1]);
      const name = decodeURIComponent(fim[2]);
      if (!validName(folder) || !validName(name)) return json({ error: "invalid name" }, 400);
      const file = promptPath(folder, name);
      if (!existsSync(file)) return json({ error: "not found" }, 404);

      if (req.method === "GET") {
        return json({ name, content: readFileSync(file, "utf8") });
      }
      if (req.method === "PUT") {
        const body = await req.json().catch(() => ({}));
        let newName = name;
        if (body.name !== undefined && String(body.name) !== name) {
          newName = String(body.name);
          if (!validName(newName)) return json({ error: "invalid prompt name" }, 400);
          if (existsSync(promptPath(folder, newName))) return json({ error: "duplicate prompt" }, 409);
          renameSync(file, promptPath(folder, newName));
        }
        if (body.content !== undefined) {
          writeFileSync(promptPath(folder, newName), String(body.content));
        }
        return json({ name: newName, content: readFileSync(promptPath(folder, newName), "utf8") });
      }
      if (req.method === "DELETE") {
        rmSync(file);
        return json({ ok: true });
      }
    }

    return json({ error: "not found" }, 404);
  },
});

console.log(`prompt-forge running at http://localhost:${server.port}`);
