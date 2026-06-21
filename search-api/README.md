# Search API

Clean HTTP interface wrapping Typesense for deterministic code search. Foundation for CLI, VS Code, and chat agent tooling.

## Quick Start

```bash
cd search-api
npm install
npm run dev
```

Server runs on `:5050` by default. Requires Typesense running on `:8108`.

## Configuration

Environment variables:

```bash
TYPESENSE_HOST=localhost
TYPESENSE_PORT=8108
TYPESENSE_PROTOCOL=http
TYPESENSE_API_KEY=dev-key
SERVER_HOST=localhost
SERVER_PORT=5050
CORS_ORIGIN=http://localhost:*
```

## Endpoints

### `GET /health`

Health check.

```bash
curl http://localhost:5050/health
```

Response: `{ "status": "ok" }`

### `GET /search`

Search code files.

**Parameters:**

- `q` — query string (required)
- `query_by` — fields to search (default: `content,symbols,imports`)
- `repo` — filter by repo (optional)
- `language` — filter by language (optional)
- `phase` — filter by CIC phase (optional)
- `adapter` — filter by adapter (optional)
- `per_page` — results per page (default: 20, max: 100)
- `page` — page number (default: 1)

**Example:**

```bash
# Search for WarmPoolManager
curl "http://localhost:5050/search?q=WarmPoolManager&query_by=symbols"

# Search in CIC repo
curl "http://localhost:5050/search?q=hydrate&repo=cic"

# Search Phase 27 code
curl "http://localhost:5050/search?q=spawn&phase=27"

# Search imports
curl "http://localhost:5050/search?q=puppeteer&query_by=imports&repo=cic"
```

**Response:**

```json
{
  "query": "WarmPoolManager",
  "count": 2,
  "results": [
    {
      "path": "src/agents/WarmPoolManager.ts",
      "repo": "castironforge",
      "language": "ts",
      "phase": "27",
      "adapter": "WarmPoolManager",
      "symbols": ["WarmPoolManager", "hydrate", "spawn"],
      "functions": ["hydrate", "spawn"],
      "classes": ["WarmPoolManager"],
      "imports": ["puppeteer", "./WarmPool"],
      "exports": ["WarmPoolManager"]
    }
  ]
}
```

### `GET /search/facets`

Get aggregated facet counts (repo, language, phase, adapter).

**Example:**

```bash
curl http://localhost:5050/search/facets
```

**Response:**

```json
{
  "repo": { "counts": [["castironforge", 1200]] },
  "language": { "counts": [["ts", 800], ["js", 250]] },
  "phase": { "counts": [["27", 150], ["26", 200]] },
  "adapter": { "counts": [["WarmPoolManager", 45]] }
}
```

## Query Examples

### Find all references to a symbol

```bash
curl "http://localhost:5050/search?q=WarmPoolManager&query_by=content,symbols,imports"
```

### Find functions named `hydrate`

```bash
curl "http://localhost:5050/search?q=hydrate&query_by=functions"
```

### Find all Phase 27 adapters

```bash
curl "http://localhost:5050/search?q=Adapter&phase=27&query_by=content,symbols"
```

### Find TODOs

```bash
curl "http://localhost:5050/search?q=TODO&query_by=todos,content"
```

### Find files importing Qdrant

```bash
curl "http://localhost:5050/search?q=qdrant&query_by=imports"
```

## Integration Points

### CLI Tool (`ts-find`)

```bash
ts-find hydrate                          # keyword search
ts-find --symbols WarmPoolManager        # symbol search
ts-find --repo cic --phase 27            # faceted search
```

### VS Code Extension

Calls `/search` on user input, displays results in sidebar, jump-to-file on click.

### Chat Agent

```typescript
const res = await fetch("http://localhost:5050/search?q=WarmPoolManager&query_by=symbols");
const data = await res.json();
// Use data.results to read files and ground answers
```

### TorqueQuery Hybrid Search

Hybrid adapter calls this for keyword search, fans out to Qdrant for semantic search, merges results.

## Error Handling

All errors return JSON:

```json
{
  "error": "Query parameter 'q' is required"
}
```

HTTP status codes:

- `200` — success
- `400` — bad request (missing required param)
- `500` — server error (Typesense unavailable, etc.)

## Performance

- ~50ms per search (Typesense query + serialization)
- Supports ~100 concurrent searches
- Memory: ~20MB base

## Deployment

Run alongside Typesense and indexer:

```bash
docker-compose up search-api
```

Or standalone:

```bash
npm install
npm run build
SERVER_PORT=5050 npm start
```

## License

Part of CIC system.
