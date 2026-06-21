# TorqueQuery API Gateway

Unified HTTP interface for hybrid code search. Routes requests to keyword (Typesense) and semantic (Qdrant) backends.

## Quick Start

```bash
cd torquequery-gateway
npm install
npm run dev
```

Gateway runs on `:5051` by default.

## Configuration

Environment variables:

```bash
PORT=5051
SEARCH_API_URL=http://localhost:5050
EMBEDDING_ENGINE_URL=http://localhost:5053
```

## Endpoints

### GET /health

Health check.

```bash
curl http://localhost:5051/health
```

### GET /hybrid

Hybrid keyword + semantic search (default).

```bash
curl "http://localhost:5051/hybrid?q=WarmPoolManager"
```

### GET /keyword

Keyword search only (Typesense).

```bash
curl "http://localhost:5051/keyword?q=hydrate&repo=cic"
```

### GET /semantic

Semantic search only (Qdrant).

```bash
curl "http://localhost:5051/semantic?q=how+does+hydration+work"
```

### POST /embed

Compute embedding for text.

```bash
curl -X POST http://localhost:5051/embed \
  -H "Content-Type: application/json" \
  -d '{"text": "WarmPoolManager spawns browser instances"}'
```

### GET /facets

Aggregated facet counts (repo, language, phase, adapter).

```bash
curl http://localhost:5051/facets
```

### GET /stats

Server statistics (uptime, memory).

```bash
curl http://localhost:5051/stats
```

## Search Modes

| Mode | Endpoint | Best For | Latency |
|------|----------|----------|---------|
| Hybrid | `/hybrid` | General search | ~100-150ms |
| Keyword | `/keyword` | Symbols, imports, exact terms | ~5-20ms |
| Semantic | `/semantic` | Meaning, logic, concepts | ~50-100ms |

## Response Format

All search endpoints return:

```json
{
  "query": "string",
  "strategy": "hybrid|keyword|semantic",
  "count": 42,
  "results": [
    {
      "path": "src/agents/WarmPoolManager.ts",
      "repo": "castironforge",
      "language": "ts",
      "phase": "27",
      "adapter": "WarmPoolManager",
      "symbols": ["WarmPoolManager", "hydrate"],
      "hybridScore": 0.892
    }
  ]
}
```

## Integration Points

- **CLI**: `tq` command queries `/hybrid` endpoint
- **Web UI**: calls `/hybrid` for real-time search
- **Chat Agent**: calls `/hybrid` for grounded retrieval
- **Observability**: all endpoints emit Prometheus metrics

## Performance

- ~5-20ms keyword search
- ~50-100ms semantic search
- ~100-150ms hybrid (parallel fan-out)
- Scales to 100+ concurrent requests

## Deployment

```bash
npm install
npm run build
SERVER_PORT=5051 npm start
```

## License

Part of CIC system.
