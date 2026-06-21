import express, { Request, Response } from "express";
import cors from "cors";
import crypto from "crypto";
import NodeCache from "node-cache";

const app = express();
app.use(cors());
app.use(express.json());

const cache = new NodeCache({ stdTTL: 3600, checkperiod: 600 });

function generateDeterministicEmbedding(text: string, dimension: number = 768): number[] {
  const hash = crypto.createHash("sha256").update(text).digest();
  const vec: number[] = [];

  for (let i = 0; i < dimension; i++) {
    const byteIndex = i % hash.length;
    const byte = hash[byteIndex];
    vec.push((byte / 255) * 2 - 1);
  }

  return normalize(vec);
}

function normalize(vec: number[]): number[] {
  const magnitude = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
  if (magnitude === 0) return vec;
  return vec.map(v => v / magnitude);
}

function routeModel(text: string): string {
  const len = text.length;
  if (len < 200) return "small";
  if (len < 2000) return "medium";
  return "large";
}

function getDimension(model: string): number {
  switch (model) {
    case "small":
      return 384;
    case "medium":
      return 768;
    case "large":
      return 1536;
    default:
      return 768;
  }
}

app.post("/embed", (req: Request, res: Response) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: "Text required" });
    }

    const cacheKey = crypto.createHash("sha256").update(text).digest("hex");
    const cached = cache.get(cacheKey);

    if (cached) {
      return res.json({
        text: text.substring(0, 100),
        embedding: cached,
        cached: true
      });
    }

    const model = routeModel(text);
    const dimension = getDimension(model);
    const embedding = generateDeterministicEmbedding(text, dimension);

    cache.set(cacheKey, embedding);

    res.json({
      text: text.substring(0, 100),
      embedding,
      model,
      dimension,
      cached: false
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post("/embed/batch", (req: Request, res: Response) => {
  try {
    const { texts } = req.body;

    if (!Array.isArray(texts)) {
      return res.status(400).json({ error: "texts array required" });
    }

    const results = texts.map(text => {
      const cacheKey = crypto.createHash("sha256").update(text).digest("hex");
      const cached = cache.get(cacheKey);

      if (cached) {
        return {
          text: text.substring(0, 100),
          embedding: cached,
          cached: true
        };
      }

      const model = routeModel(text);
      const dimension = getDimension(model);
      const embedding = generateDeterministicEmbedding(text, dimension);

      cache.set(cacheKey, embedding);

      return {
        text: text.substring(0, 100),
        embedding,
        model,
        cached: false
      };
    });

    res.json({ count: results.length, results });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get("/search", async (req: Request, res: Response) => {
  try {
    const q = req.query.q as string;

    if (!q) {
      return res.status(400).json({ error: "Query required" });
    }

    const embedding = generateDeterministicEmbedding(q);

    res.json({
      query: q,
      embedding,
      count: 0,
      results: []
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get("/health", (req: Request, res: Response) => {
  res.json({
    status: "ok",
    cache_size: cache.keys().length,
    cache_stats: cache.getStats()
  });
});

const port = process.env.PORT ?? 5053;

app.listen(port, () => {
  console.log(`TorqueQuery Embedding Engine v2 running on http://localhost:${port}`);
  console.log(`  - /embed (POST) — embed single text`);
  console.log(`  - /embed/batch (POST) — embed multiple texts`);
  console.log(`  - /search — semantic search`);
  console.log(`  - /health — health check with cache stats`);
});
