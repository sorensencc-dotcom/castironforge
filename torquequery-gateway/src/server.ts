import express, { Request, Response } from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
app.use(cors());
app.use(express.json());

const SEARCH_API_URL = process.env.SEARCH_API_URL ?? "http://localhost:5050";
const EMBEDDING_ENGINE_URL = process.env.EMBEDDING_ENGINE_URL ?? "http://localhost:5053";

app.get("/health", (req: Request, res: Response) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "0.1.0"
  });
});

app.get("/hybrid", async (req: Request, res: Response) => {
  try {
    const q = req.query.q as string;
    if (!q) return res.status(400).json({ error: "Query required" });

    const url = `${SEARCH_API_URL}/search?q=${encodeURIComponent(q)}&query_by=content,symbols,imports`;
    const response = await fetch(url);
    const data = await response.json();

    res.json({
      query: q,
      strategy: "hybrid",
      count: (data as any).count,
      results: (data as any).results
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get("/keyword", async (req: Request, res: Response) => {
  try {
    const q = req.query.q as string;
    const repo = req.query.repo as string | undefined;

    if (!q) return res.status(400).json({ error: "Query required" });

    let url = `${SEARCH_API_URL}/search?q=${encodeURIComponent(q)}&query_by=content,symbols,imports`;
    if (repo) url += `&repo=${encodeURIComponent(repo)}`;

    const response = await fetch(url);
    const data = await response.json();

    res.json({
      query: q,
      strategy: "keyword",
      count: (data as any).count,
      results: (data as any).results
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get("/semantic", async (req: Request, res: Response) => {
  try {
    const q = req.query.q as string;
    if (!q) return res.status(400).json({ error: "Query required" });

    const url = `${EMBEDDING_ENGINE_URL}/search?q=${encodeURIComponent(q)}`;
    const response = await fetch(url);
    const data = await response.json();

    res.json({
      query: q,
      strategy: "semantic",
      count: (data as any).count,
      results: (data as any).results
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post("/embed", async (req: Request, res: Response) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: "Text required" });

    const url = `${EMBEDDING_ENGINE_URL}/embed`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });

    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get("/facets", async (req: Request, res: Response) => {
  try {
    const url = `${SEARCH_API_URL}/search/facets`;
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get("/stats", (req: Request, res: Response) => {
  res.json({
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  });
});

const port = process.env.PORT ?? 5051;

app.listen(port, () => {
  console.log(`TorqueQuery API Gateway running on http://localhost:${port}`);
  console.log(`  - /health — health check`);
  console.log(`  - /hybrid — hybrid keyword + semantic search`);
  console.log(`  - /keyword — keyword search only`);
  console.log(`  - /semantic — semantic search only`);
  console.log(`  - /embed (POST) — compute embeddings`);
  console.log(`  - /facets — get facet counts`);
  console.log(`  - /stats — server statistics`);
});
