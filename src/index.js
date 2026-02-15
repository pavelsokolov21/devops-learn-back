import express from "express";
import pg from "pg";
import cors from "cors";

const { Pool } = pg;

const app = express();
app.use(
  cors({
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
  }),
);
app.use(express.json());

const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("Missing env DATABASE_URL");
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
});

// простая проверка соединения при старте (полезно для логов)
await pool.query("SELECT 1");

app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false });
  }
});

/**
 * GET /api/todos
 */
app.get("/api/todos", async (_req, res) => {
  const { rows } = await pool.query(
    "SELECT id, title, completed, created_at FROM todos ORDER BY id DESC",
  );
  res.json(rows);
});

/**
 * GET /api/todos/:id
 */
app.get("/api/todos/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id))
    return res.status(400).json({ error: "Invalid id" });

  const { rows } = await pool.query(
    "SELECT id, title, completed, created_at FROM todos WHERE id = $1",
    [id],
  );

  if (rows.length === 0) return res.status(404).json({ error: "Not found" });
  res.json(rows[0]);
});

/**
 * POST /api/todos
 * body: { title: string }
 */
app.post("/api/todos", async (req, res) => {
  const title = String(req.body?.title ?? "").trim();
  if (!title) return res.status(400).json({ error: "title is required" });
  if (title.length > 200)
    return res.status(400).json({ error: "title too long" });

  const { rows } = await pool.query(
    "INSERT INTO todos (title) VALUES ($1) RETURNING id, title, completed, created_at",
    [title],
  );

  res.status(201).json(rows[0]);
});

/**
 * PUT /api/todos/:id
 * body: { title?: string, completed?: boolean }
 */
app.put("/api/todos/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id))
    return res.status(400).json({ error: "Invalid id" });

  const hasTitle = "title" in (req.body ?? {});
  const hasCompleted = "completed" in (req.body ?? {});

  if (!hasTitle && !hasCompleted) {
    return res.status(400).json({ error: "Nothing to update" });
  }

  const title = hasTitle ? String(req.body.title ?? "").trim() : null;
  const completed = hasCompleted ? Boolean(req.body.completed) : null;

  if (hasTitle) {
    if (!title) return res.status(400).json({ error: "title cannot be empty" });
    if (title.length > 200)
      return res.status(400).json({ error: "title too long" });
  }

  const { rows } = await pool.query(
    `
    UPDATE todos
    SET
      title = COALESCE($2, title),
      completed = COALESCE($3, completed)
    WHERE id = $1
    RETURNING id, title, completed, created_at
    `,
    [id, title, completed],
  );

  if (rows.length === 0) return res.status(404).json({ error: "Not found" });
  res.json(rows[0]);
});

/**
 * DELETE /api/todos/:id
 */
app.delete("/api/todos/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id))
    return res.status(400).json({ error: "Invalid id" });

  const { rowCount } = await pool.query("DELETE FROM todos WHERE id = $1", [
    id,
  ]);
  if (rowCount === 0) return res.status(404).json({ error: "Not found" });

  res.status(204).send();
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Backend listening on 0.0.0.0:${PORT}`);
});
