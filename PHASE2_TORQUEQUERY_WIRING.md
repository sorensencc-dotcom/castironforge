# Phase 2: Wire TorqueQuery (Day 1 Afternoon)

**Goal:** Connect Typesense Indexer output to TorqueQuery API Gateway.

**Timeline:** 4-5 hours (mostly startup and verification, no code changes).

**Owner:** DevOps / Platform team.

---

## Service Dependencies

```
Typesense Indexer (:none - headless)
    ↓ indexes to
Typesense (:8108)
    ↓
Search API (:5050)
    ↓
API Gateway (:5051) ← MAIN ENTRY POINT
    ├─ /keyword → Search API
    ├─ /semantic → Embeddings Engine
    └─ /hybrid → both (fan-out + merge)
```

---

## 2.1: Start Search API (:5050)

**Purpose:** HTTP wrapper around Typesense, handles filtering and facets.

### Setup

```bash
cd search-api
npm install
npm run build
```

### Configuration

**Environment Variables:**

```bash
export TYPESENSE_HOST=localhost
export TYPESENSE_PORT=8108
export TYPESENSE_PROTOCOL=http
export TYPESENSE_API_KEY=dev-key
export SERVER_HOST=localhost
export SERVER_PORT=5050
```

Or edit `search-api/src/config.ts`:

```typescript
export const CONFIG = {
  typesense: {
    host: process.env.TYPESENSE_HOST ?? "localhost",
    port: parseInt(process.env.TYPESENSE_PORT ?? "8108", 10),
    protocol: process.env.TYPESENSE_PROTOCOL ?? "http",
    apiKey: process.env.TYPESENSE_API_KEY ?? "dev-key"
  },
  server: {
    host: process.env.SERVER_HOST ?? "localhost",
    port: parseInt(process.env.SERVER_PORT ?? "5050", 10)
  }
};
```

### Start Service

```bash
npm run dev
# Output: Server running on http://localhost:5050
```

### Verify

```bash
# Check server health
curl http://localhost:5050/health

# Expected:
# {"status": "ok", "typesense": "healthy"}

# Search for indexed files
curl "http://localhost:5050/search?q=*&per_page=5"

# Expected:
# {
#   "query": "*",
#   "count": 1247,
#   "results": [...]
# }
```

**Checklist:**
- [ ] Search API running on :5050
- [ ] Typesense connection successful
- [ ] /search endpoint returns results
- [ ] Query filters work (repo, phase, adapter)

---

## 2.2: Start Embedding Engine (:5053)

**Purpose:** Deterministic embeddings (SHA256-based, not ML).

### Setup

```bash
cd torquequery-embeddings
npm install
npm run build
```

### Configuration

**No external dependencies** — embeddings are deterministic based on text SHA256.

Environment variables (optional):

```bash
export PORT=5053
export MODEL_DEFAULT=medium
export CACHE_TTL_MS=3600000
```

Or edit `torquequery-embeddings/src/server.ts`:

```typescript
const PORT = process.env.PORT ?? 5053;
const MODEL_DEFAULT = process.env.MODEL_DEFAULT ?? "medium";
const CACHE_TTL_MS = parseInt(process.env.CACHE_TTL_MS ?? "3600000", 10);
```

### Start Service

```bash
npm run dev
# Output: Server running on port 5053
```

### Verify

```bash
# Embed text
curl -X POST http://localhost:5053/embed \
  -H "Content-Type: application/json" \
  -d '{"text": "WarmPoolManager"}'

# Expected:
# {
#   "text": "WarmPoolManager",
#   "embedding": [0.123, 0.456, ...],
#   "model": "medium",
#   "dimension": 768,
#   "cached": false
# }

# Run again — should be cached
curl -X POST http://localhost:5053/embed \
  -H "Content-Type: application/json" \
  -d '{"text": "WarmPoolManager"}'

# Expected:
# {
#   "text": "WarmPoolManager",
#   "embedding": [0.123, 0.456, ...],  ← IDENTICAL
#   "model": "medium",
#   "dimension": 768,
#   "cached": true  ← Cached!
# }
```

**Checklist:**
- [ ] Embedding Engine running on :5053
- [ ] POST /embed returns vectors
- [ ] Embeddings are deterministic (same text = same vector)
- [ ] Cache working (cached: true on repeat)

---

## 2.3: Start API Gateway (:5051)

**Purpose:** Unified search API, routes to Search API or Embeddings Engine.

### Setup

```bash
cd torquequery-gateway
npm install
npm run build
```

### Configuration

**Environment Variables:**

```bash
export SEARCH_API_URL=http://localhost:5050
export EMBEDDING_ENGINE_URL=http://localhost:5053
export PORT=5051
export LOG_LEVEL=info
```

Or edit `torquequery-gateway/src/server.ts`:

```typescript
const SEARCH_API_URL = process.env.SEARCH_API_URL ?? "http://localhost:5050";
const EMBEDDING_ENGINE_URL = process.env.EMBEDDING_ENGINE_URL ?? "http://localhost:5053";
const PORT = parseInt(process.env.PORT ?? "5051", 10);
```

### Start Service

```bash
npm run dev
# Output: Gateway running on http://localhost:5051
```

### Verify All Three Routes

```bash
# 1. Keyword search (Typesense only)
curl "http://localhost:5051/keyword?q=spawn"
# Expected: keyword search results

# 2. Semantic search (Embeddings only)
curl "http://localhost:5051/semantic?q=how+does+the+pool+work"
# Expected: semantic search results

# 3. Hybrid search (both)
curl "http://localhost:5051/hybrid?q=WarmPoolManager"
# Expected: merged results with hybrid scores
```

**Checklist:**
- [ ] API Gateway running on :5051
- [ ] /keyword endpoint works
- [ ] /semantic endpoint works
- [ ] /hybrid endpoint works (merged results)

---

## 2.4: Verify Full Pipeline Integration

### End-to-End Test

```bash
# Step 1: Verify Typesense has indexed files
curl -H "X-TYPESENSE-API-KEY: dev-key" \
  "http://localhost:8108/collections/code_files/documents/search?q=*&per_page=1" \
  | jq '.found'
# Expected: 1247 (or number of indexed files)

# Step 2: Search API queries Typesense
curl "http://localhost:5050/search?q=warmPool" | jq '.count'
# Expected: > 0

# Step 3: Embeddings produce vectors
curl -X POST http://localhost:5053/embed \
  -H "Content-Type: application/json" \
  -d '{"text":"test"}' | jq '.embedding | length'
# Expected: 768 (or 384 for small model)

# Step 4: Gateway merges results
curl "http://localhost:5051/hybrid?q=warmPool" | jq '.results | length'
# Expected: > 0
```

### Expected Output

```
1247        # Typesense has indexed files
2           # Search API found results
768         # Embeddings have correct dimension
2           # Gateway returns merged results
```

**Checklist:**
- [ ] Typesense has >10 indexed documents
- [ ] Search API returns results
- [ ] Embedding Engine produces vectors
- [ ] API Gateway merges and ranks results
- [ ] Full pipeline works end-to-end

---

## 2.5: Wire Services in docker-compose.yml

Update docker-compose.yml to include all Phase 2 services:

```yaml
services:
  # Phase 1: Typesense Indexer
  typesense:
    image: typesense/typesense:latest
    container_name: cic-typesense
    ports:
      - "8108:8108"
    environment:
      TYPESENSE_API_KEY: dev-key
    volumes:
      - typesense_data:/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8108/health"]
      interval: 10s
      timeout: 5s
      retries: 3

  typesense-indexer:
    build:
      context: ./typesense-indexer
      dockerfile: Dockerfile
    container_name: cic-indexer
    environment:
      CIC_INDEXER_TYPESENSE_HOST: typesense
      CIC_INDEXER_TYPESENSE_PORT: "8108"
    depends_on:
      typesense:
        condition: service_healthy

  # Phase 2: TorqueQuery Services
  search-api:
    build:
      context: ./search-api
      dockerfile: Dockerfile
    container_name: cic-search-api
    ports:
      - "5050:5050"
    environment:
      TYPESENSE_HOST: typesense
      TYPESENSE_PORT: "8108"
      SERVER_PORT: "5050"
    depends_on:
      typesense:
        condition: service_healthy

  torquequery-embeddings:
    build:
      context: ./torquequery-embeddings
      dockerfile: Dockerfile
    container_name: cic-embeddings
    ports:
      - "5053:5053"
    environment:
      PORT: "5053"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5053/health"]
      interval: 10s
      timeout: 5s
      retries: 3

  torquequery-gateway:
    build:
      context: ./torquequery-gateway
      dockerfile: Dockerfile
    container_name: cic-gateway
    ports:
      - "5051:5051"
    environment:
      SEARCH_API_URL: http://search-api:5050
      EMBEDDING_ENGINE_URL: http://torquequery-embeddings:5053
      PORT: "5051"
    depends_on:
      - search-api
      - torquequery-embeddings

volumes:
  typesense_data:

networks:
  default:
    name: cic-network
    driver: bridge
```

### Start All Services

```bash
docker compose up -d
docker compose logs -f torquequery-gateway
```

---

## 2.6: Performance Validation

Measure latency for each search mode:

```bash
# Keyword search (target: <20ms)
time curl -s "http://localhost:5051/keyword?q=spawn" > /dev/null
# Real: ~5-15ms ✓

# Semantic search (target: <100ms)
time curl -s "http://localhost:5051/semantic?q=how+do+browsers+spawn" > /dev/null
# Real: ~50-80ms ✓

# Hybrid search (target: <150ms)
time curl -s "http://localhost:5051/hybrid?q=WarmPoolManager" > /dev/null
# Real: ~100-120ms ✓
```

**Checklist:**
- [ ] Keyword search < 20ms
- [ ] Semantic search < 100ms
- [ ] Hybrid search < 150ms

---

## Troubleshooting

### Issue: Search API returns 500 error

**Cause:** Can't connect to Typesense.

**Fix:**
```bash
# Verify Typesense is running
curl http://localhost:8108/health

# Check network connectivity (Docker)
docker network inspect cic-network

# Restart Search API
docker restart cic-search-api
```

### Issue: Embeddings engine not responding

**Cause:** Port 5053 already in use or service crashed.

**Fix:**
```bash
# Check if port is in use
lsof -i :5053

# Kill process if needed
kill -9 <PID>

# Restart embeddings
npm run dev  # in torquequery-embeddings/
```

### Issue: Gateway returns empty results

**Cause:** Backend services (Search API or Embeddings) not healthy.

**Fix:**
```bash
# Check all services are running
docker ps | grep cic-

# Check Search API health
curl http://localhost:5050/health

# Check Embeddings health
curl http://localhost:5053/health

# Restart gateway
docker restart cic-gateway
```

---

## Phase 2 Complete ✅

**Services Running:**
- Typesense (:8108) — Code index
- Search API (:5050) — Keyword search wrapper
- Embedding Engine (:5053) — Deterministic vectors
- API Gateway (:5051) — Unified search interface

**Verified:**
- All three search modes working (/keyword, /semantic, /hybrid)
- Performance targets met
- Full pipeline operational end-to-end

**Next:** Phase 3 (Enable Agent Tools)

---

**Timeline:** 4-5 hours total (mostly waiting for services to start)

**Owner:** Platform team

**Handoff Criteria:**
- [ ] All four services running and healthy
- [ ] All three search endpoints responding
- [ ] Performance benchmarks met
- [ ] Ready for Phase 3 (agent integration)
