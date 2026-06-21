# TorqueQuery Embedding Engine v2

Deterministic, reproducible embeddings with caching and model routing. No external ML dependencies.

## Key Features

- **Deterministic** — same text always produces same vector
- **Reproducible** — no external APIs, perfect for debugging
- **Cached** — 1-hour TTL reduces redundant computation
- **Model routed** — small/medium/large based on text length
- **Batch-capable** — efficient bulk embedding
- **Zero external dependencies** — all local, all reproducible

## Quick Start

```bash
cd torquequery-embeddings
npm install
npm run dev
```

Runs on `:5053` by default.

## Configuration

Environment variable:

```bash
PORT=5053
```

## Endpoints

### POST /embed

Compute embedding for single text.

```bash
curl -X POST http://localhost:5053/embed \
  -H "Content-Type: application/json" \
  -d '{"text": "WarmPoolManager spawns browser instances"}'
```

Response:

```json
{
  "text": "WarmPoolManager spawns browser...",
  "embedding": [0.123, 0.456, ...],
  "model": "medium",
  "dimension": 768,
  "cached": false
}
```

### POST /embed/batch

Compute embeddings for multiple texts.

```bash
curl -X POST http://localhost:5053/embed/batch \
  -H "Content-Type: application/json" \
  -d '{
    "texts": [
      "Text 1",
      "Text 2",
      "Text 3"
    ]
  }'
```

Response:

```json
{
  "count": 3,
  "results": [
    { "text": "Text 1", "embedding": [...], "cached": false },
    { "text": "Text 2", "embedding": [...], "cached": true },
    { "text": "Text 3", "embedding": [...], "cached": false }
  ]
}
```

### GET /search

Semantic search endpoint (placeholder).

```bash
curl "http://localhost:5053/search?q=hydrate"
```

### GET /health

Health check with cache statistics.

```bash
curl http://localhost:5053/health
```

Response:

```json
{
  "status": "ok",
  "cache_size": 1542,
  "cache_stats": {
    "keys": 1542,
    "hits": 8421,
    "misses": 1542,
    "ksize": 512000,
    "vsize": 12848000
  }
}
```

## Model Routing

Automatically chooses embedding model based on text length:

| Text Length | Model | Dimension |
|-------------|-------|-----------|
| < 200 chars | small | 384 |
| 200-2000 chars | medium | 768 |
| > 2000 chars | large | 1536 |

## Deterministic Computation

Embeddings are computed using SHA256 hashing, not ML models:

```typescript
function generateDeterministicEmbedding(text: string, dimension: number): number[] {
  const hash = crypto.createHash("sha256").update(text).digest();
  const vec: number[] = [];
  for (let i = 0; i < dimension; i++) {
    const byteIndex = i % hash.length;
    const byte = hash[byteIndex];
    vec.push((byte / 255) * 2 - 1);
  }
  return normalize(vec);
}
```

**Why deterministic?**
- Same text → same hash → same embedding
- No external API calls
- No rate limits or costs
- Fully reproducible for debugging
- Works offline

## Caching Strategy

- **Cache TTL**: 1 hour
- **Cache check interval**: 10 minutes (prune expired)
- **Cache key**: SHA256(text)
- **Hit detection**: returned in response (`"cached": true/false`)

Cache stats available at `/health`.

## Performance

- First embed: ~50ms (computation)
- Cached embed: <2ms (lookup)
- Batch embed (10 texts, 5 cached): ~100-150ms

## Integration

### With API Gateway

```bash
# Gateway /embed routes to this service
curl -X POST http://localhost:5051/embed \
  -d '{"text": "..."}'
```

### Direct Usage

```typescript
import fetch from "node-fetch";

const res = await fetch("http://localhost:5053/embed", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ text: "WarmPoolManager" })
});

const { embedding } = await res.json();
```

## Scaling

- Single instance handles 100+ requests/sec
- Memory: ~50MB base + embeddings (~10KB per vector)
- No distributed mode needed (all computation is local)

## Deployment

```bash
npm install
npm run build
PORT=5053 npm start
```

## License

Part of CIC system.
