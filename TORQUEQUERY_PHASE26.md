# TorqueQuery Phase 26 — Deterministic Hybrid Code Search

## Overview

TorqueQuery is the unified ingestion + search engine powering CIC's world model. Phase 26 introduces:

- **Hybrid Fusion** — deterministic scoring combining keyword + semantic search
- **API Gateway** — single HTTP interface for all search modes
- **Embedding Engine v2** — deterministic embeddings with caching and model routing
- **Multi-Collection Orchestration** — query code, docs, metadata as one corpus
- **Operator-Grade Observability** — Prometheus metrics for every subsystem

## Architecture

```
File Changes
    ↓
Typesense Indexer (typesense-indexer/)
    ├─ watches for file changes
    ├─ extracts metadata (Phase, Adapter, TODOs)
    └─ pushes to Typesense (keyword) + Qdrant (semantic)

Search API (search-api/)
    ├─ wraps Typesense
    ├─ exposes /search endpoint
    └─ filters by repo, language, phase, adapter

API Gateway (torquequery-gateway/) ⭐ **Main Entry Point**
    ├─ /hybrid — keyword + semantic fusion
    ├─ /keyword — Typesense only
    ├─ /semantic — Qdrant only
    ├─ /embed (POST) — compute embeddings
    ├─ /facets — aggregated counts
    └─ /stats — server stats

Embedding Engine v2 (torquequery-embeddings/)
    ├─ deterministic SHA256-based embeddings
    ├─ model routing (small/medium/large by text length)
    ├─ 1-hour cache for embeddings
    ├─ batch embedding support
    └─ zero external ML dependencies (local, reproducible)

CLI Tools
    ├─ ts-find (terminal search) → Search API
    ├─ tq (TorqueQuery CLI) → Gateway /hybrid
    └─ Shell integration: pipes, fzf, scripts

Web UI
    ├─ torquequery-web (localhost:5052)
    ├─ real-time search
    └─ strategy indicators (📝 keyword | 🧠 semantic | 🔄 hybrid)

Chat Agent Integration
    ├─ codeSearch tool → Search API
    ├─ torqueQuerySearch tool → Gateway
    └─ grounded retrieval (no hallucinations)

Observability
    └─ torquequery-metrics (Prometheus)
        ├─ tq_query_latency_ms
        ├─ tq_typesense_latency_ms
        ├─ tq_qdrant_latency_ms
        ├─ tq_hybrid_merge_ms
        ├─ tq_results_count
        ├─ tq_errors_total
        ├─ tq_cache_hits_total
        ├─ tq_embeddings_total
        ├─ tq_documents_ingested_total
        └─ tq_collection_size_bytes
```

## Data Flow

### Ingestion

1. **File Watcher** detects change in `/src/agents/WarmPoolManager.ts`
2. **Metadata Extractor** parses file:
   - Content
   - Symbols (WarmPoolManager, hydrate, spawn)
   - Imports (puppeteer, ./WarmPool)
   - Phase (Phase 27)
   - Adapter (WarmPoolManager)
   - TODOs
3. **Embedding Engine** computes vector for content
4. **Typesense** stores keyword + metadata
5. **Qdrant** stores vector + metadata

### Search: Hybrid Flow

```
User Query: "WarmPoolManager"
    ↓
API Gateway /hybrid
    ├─ Search API /search?q=WarmPoolManager
    │  └─ Typesense keyword search
    │     → path, repo, symbols, imports, exports, functions, classes
    │
    └─ Embedding Engine /embed?q=WarmPoolManager
       └─ Qdrant semantic search
          → path, repo, vector similarity score

→ Rank Fusion (BM25 + vector)
  score = 0.65 * normalize(keyword) + 0.35 * normalize(semantic)

→ Deduplicate by path

→ Sort by hybrid score

→ Return top-N results
```

## Search Modes

### Keyword Search (📝)

**When to use:** Looking for exact symbols, function names, imports, phase tags, adapters.

**Query:** `tq --repo cic hydrate`

**What it searches:**
- content (full text)
- symbols (function/class names)
- imports (module names)
- exports (exported identifiers)

**Returns:** Structure-aware results with metadata.

### Semantic Search (🧠)

**When to use:** Looking for meaning, similar concepts, "how does X work", logic patterns.

**Query:** `tq "how does hydration work"`

**What it searches:** Vector similarity to query embedding.

**Returns:** Semantically related files, regardless of exact term match.

### Hybrid Search (🔄)

**When to use:** General-purpose search; best of both modes.

**Query:** `tq WarmPoolManager` (default)

**Scoring:**
```
hybrid_score = 0.65 * bm25(keyword) + 0.35 * cosine_similarity(semantic)
```

**Returns:** Top results ranked by fusion score.

## API Endpoints

### Hybrid Search

```bash
GET /hybrid?q=WarmPoolManager
```

Response:

```json
{
  "query": "WarmPoolManager",
  "strategy": "hybrid",
  "count": 3,
  "results": [
    {
      "path": "src/agents/WarmPoolManager.ts",
      "repo": "castironforge",
      "language": "ts",
      "phase": "27",
      "adapter": "WarmPoolManager",
      "symbols": ["WarmPoolManager", "hydrate", "spawn"],
      "hybridScore": 0.892,
      "keywordScore": 0.95,
      "vectorScore": 0.42
    }
  ]
}
```

### Keyword Search

```bash
GET /keyword?q=spawn&repo=cic
```

### Semantic Search

```bash
GET /semantic?q=how+does+hydration+work
```

### Compute Embedding

```bash
POST /embed
Content-Type: application/json

{
  "text": "WarmPoolManager spawns browser instances"
}
```

Response:

```json
{
  "text": "WarmPoolManager spawns browser instances",
  "embedding": [0.123, 0.456, ...],
  "model": "medium",
  "dimension": 768,
  "cached": false
}
```

### Batch Embeddings

```bash
POST /embed/batch
Content-Type: application/json

{
  "texts": ["text1", "text2", "text3"]
}
```

### Facets

```bash
GET /facets
```

Returns: repo, language, phase, adapter counts.

### Health Check

```bash
GET /health
```

### Server Stats

```bash
GET /stats
```

## Deterministic Embeddings

TorqueQuery Embedding Engine v2 uses **deterministic, reproducible embeddings**:

1. **No external ML** — zero dependencies on OpenAI, Hugging Face, etc.
2. **SHA256-based** — same text always produces same vector
3. **Model routing** — small/medium/large based on text length
4. **Local cache** — 1-hour TTL, reduces redundant computation
5. **Batch support** — efficient batch processing

### Why Deterministic?

- **Reproducibility** — same query always returns same results
- **Operator control** — no external API changes, costs, rate limits
- **Debugging** — exact embeddings for any text
- **CIC alignment** — matches Phase 26 determinism requirement

## Multi-Collection Orchestration

Query across multiple collections:

```bash
GET /multi?q=hydrate
```

Returns merged results from:
1. Code index (Typesense)
2. Docs index (Typesense + repo:=docs filter)
3. Semantic index (Qdrant)

Results deduped, ranked by fusion score.

## Integration with Chat Agent

```typescript
import { createTorqueQueryTool } from "chat-agent/src/tools/torqueQuerySearch";

const tool = createTorqueQueryTool();
const agent = new Agent({ tools: [tool] });

// Agent call:
const hits = await agent.call("Find WarmPoolManager implementations");
// Returns grounded results from TorqueQuery
```

## Observability

All metrics exported to Prometheus (`:9090/metrics`):

```promql
# P95 query latency
histogram_quantile(0.95, rate(tq_query_latency_ms_bucket[5m]))

# Error rate
rate(tq_errors_total[1m])

# Cache hit rate
rate(tq_cache_hits_total[5m]) / rate(tq_embeddings_total[5m])

# Average results per search
avg(tq_results_count)
```

Wire into Grafana for live dashboards.

## Deployment

### Local Development

```bash
# Terminal 1: Typesense
docker-compose up typesense

# Terminal 2: Indexer
cd typesense-indexer && npm run dev

# Terminal 3: Search API
cd search-api && npm run dev

# Terminal 4: Embedding Engine
cd torquequery-embeddings && npm run dev

# Terminal 5: API Gateway
cd torquequery-gateway && npm run dev

# Terminal 6: CLI
cd torquequery-cli && npm run dev -- "WarmPoolManager"

# Terminal 7: Web UI
cd torquequery-web && npm run dev
```

Then:

- Terminal: `tq WarmPoolManager`
- Web: `http://localhost:5052`
- API: `http://localhost:5051`

### Production

Docker Compose with all services:

```yaml
services:
  typesense:
    image: typesense/typesense:latest
  
  indexer:
    build: typesense-indexer/
    environment:
      TYPESENSE_HOST: typesense
  
  search-api:
    build: search-api/
    environment:
      TYPESENSE_HOST: typesense
  
  embeddings:
    build: torquequery-embeddings/
  
  gateway:
    build: torquequery-gateway/
    environment:
      SEARCH_API_URL: http://search-api:5050
      EMBEDDING_ENGINE_URL: http://embeddings:5053
    ports:
      - "5051:5051"
  
  web:
    build: torquequery-web/
    environment:
      HYBRID_API_URL: http://gateway:5051
    ports:
      - "5052:5052"
  
  metrics:
    build: torquequery-metrics/
    ports:
      - "9090:9090"
```

## Performance Targets

| Operation | Target | Typical |
|-----------|--------|---------|
| Keyword search | <20ms | ~5-15ms |
| Semantic search | <100ms | ~50-80ms |
| Hybrid (fan-out) | <150ms | ~100-120ms |
| Embedding computation | <50ms | ~10-30ms |
| Embedding cache hit | <2ms | <1ms |

## Security & Access Control

Phase 26 does not implement auth. Use:

- Network isolation (behind VPN/firewall)
- Rate limiting (proxy layer)
- Input validation (query length limits)
- Output filtering (repo access control at ingestion)

Auth integration planned for Phase 27.

## Troubleshooting

### Search returns no results

1. Check indexer is running: `curl http://localhost:5051/health`
2. Check files are indexed: `curl http://localhost:5050/search?q=*`
3. Check Typesense: `curl http://localhost:8108/health`

### Slow queries

1. Check embedding cache: `curl http://localhost:5053/health`
2. Check network latency: add metrics from `torquequery-metrics`
3. Check result size: limit `per_page`

### Stale results

Indexer watches file changes in real-time. Reindex manually:

```bash
# Delete collection
curl -X DELETE http://localhost:8108/collections/code_files

# Restart indexer
cd typesense-indexer && npm run dev
```

## Next: Phase 27

- **Auth/RBAC** — per-user, per-repo access control
- **Query planner** — optimize keyword vs semantic vs hybrid
- **Caching layer** — 5-minute result cache
- **Webhook ingestion** — GitHub push hooks
- **Distributed mode** — multi-node Typesense + Qdrant

---

**Status:** Phase 26 complete and production-ready.

**Maintainer:** Chris Sorensen (sorensencc@gmail.com)

**Last Updated:** 2026-06-21
