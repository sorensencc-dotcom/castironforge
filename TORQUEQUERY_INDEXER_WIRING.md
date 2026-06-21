# TorqueQuery-Indexer Wiring Guide

**Purpose:** Connect Typesense Indexer output to TorqueQuery API Gateway.

**Audience:** DevOps, system architects, anyone deploying Phase 26.

**Time to implement:** 30 minutes (mostly config, no code changes).

---

## Architecture: The Pipeline

```
Typesense Indexer (chokidar watches files)
    ↓
    Extracts: symbols, imports, phase, adapter, TODOs
    ↓
    Pushes to Typesense :8108 (collection: code_files)
    ↓
Search API :5050 (wraps Typesense, serves /search)
    ↓
Embedding Engine :5053 (deterministic vectors, cache)
    ↓
API Gateway :5051 (unified interface)
    ├─ /keyword → Search API
    ├─ /semantic → Embedding Engine + Qdrant
    └─ /hybrid → both (fan-out + merge)
    ↓
Agent Tools (callTool → Gateway)
    ↓
Agents (ground reasoning, no hallucinations)
```

---

## Prerequisites

- Typesense running on :8108 (docker-compose up typesense)
- All services built locally:
  - `typesense-indexer/dist/`
  - `search-api/dist/`
  - `torquequery-embeddings/dist/`
  - `torquequery-gateway/dist/`

---

## Step 1: Verify Indexer Output (Typesense Schema)

The indexer creates a collection named `code_files` with this schema:

```json
{
  "name": "code_files",
  "fields": [
    { "name": "path", "type": "string", "facet": true },
    { "name": "repo", "type": "string", "facet": true },
    { "name": "language", "type": "string", "facet": true },
    { "name": "content", "type": "string" },
    { "name": "symbols", "type": "string[]" },
    { "name": "imports", "type": "string[]" },
    { "name": "exports", "type": "string[]" },
    { "name": "functions", "type": "string[]" },
    { "name": "classes", "type": "string[]" },
    { "name": "phase", "type": "string", "facet": true },
    { "name": "adapter", "type": "string", "facet": true },
    { "name": "todos", "type": "string[]" },
    { "name": "modified", "type": "int64", "facet": true },
    { "name": "size", "type": "int32", "facet": true },
    { "name": "hash", "type": "string" }
  ],
  "default_sorting_field": "modified"
}
```

**Verification:**

```bash
# Check collection exists
curl -H "X-TYPESENSE-API-KEY: dev-key" \
  http://localhost:8108/collections/code_files

# Check documents are indexed
curl -H "X-TYPESENSE-API-KEY: dev-key" \
  "http://localhost:8108/collections/code_files/documents/search?q=*&per_page=5"
```

**Expected Response:**
```json
{
  "hits": [
    {
      "document": {
        "id": "castironforge/src/agents/warmPoolAgent.ts",
        "path": "src/agents/warmPoolAgent.ts",
        "repo": "castironforge",
        "language": "ts",
        "symbols": ["warmPoolAgentHandle", "WarmPoolResponse", ...],
        "phase": "26",
        "adapter": "",
        "functions": ["warmPoolAgentHandle"],
        "classes": []
      }
    }
  ]
}
```

- [ ] Collection exists on Typesense
- [ ] Documents are indexed with correct schema
- [ ] Facets work (phase, repo, language, adapter)

---

## Step 2: Wire Search API to Typesense

**File:** `search-api/src/config.ts`

Ensure it points to your Typesense instance:

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

**Environment Variables (if not localhost):**

```bash
export TYPESENSE_HOST=typesense.internal
export TYPESENSE_PORT=8108
export TYPESENSE_PROTOCOL=http
export TYPESENSE_API_KEY=your-api-key
export SERVER_PORT=5050
```

**Verification:**

```bash
cd search-api
npm run dev

# In another terminal:
curl "http://localhost:5050/search?q=warmPool"
```

**Expected:**
```json
{
  "query": "warmPool",
  "count": 1,
  "results": [
    {
      "path": "src/agents/warmPoolAgent.ts",
      "repo": "castironforge",
      "symbols": ["warmPoolAgentHandle", ...],
      "language": "ts"
    }
  ]
}
```

- [ ] Search API is running on :5050
- [ ] /search endpoint returns results from Typesense
- [ ] Query filters work (repo, phase, adapter)

---

## Step 3: Wire Embedding Engine (Deterministic)

**File:** `torquequery-embeddings/src/server.ts`

No configuration needed—embeddings are deterministic (SHA256-based):

```bash
cd torquequery-embeddings
npm run dev
```

**Verification:**

```bash
# Embed same text twice, should get identical vectors
curl -X POST http://localhost:5053/embed \
  -H "Content-Type: application/json" \
  -d '{"text": "WarmPoolManager"}'

# Run twice, compare output
# Both should have identical "embedding" array
```

**Expected:**
```json
{
  "text": "WarmPoolManager",
  "embedding": [0.123, 0.456, ...],
  "model": "medium",
  "dimension": 768,
  "cached": false
}

// Second call (cached):
{
  "text": "WarmPoolManager",
  "embedding": [0.123, 0.456, ...],  // IDENTICAL
  "model": "medium",
  "dimension": 768,
  "cached": true
}
```

- [ ] Embedding Engine is running on :5053
- [ ] Embeddings are deterministic (same text = same vector)
- [ ] Cache is working (cached: true on repeat)

---

## Step 4: Wire API Gateway (The Main Hub)

**File:** `torquequery-gateway/src/server.ts`

Configure backend URLs:

```typescript
const SEARCH_API_URL = process.env.SEARCH_API_URL ?? "http://localhost:5050";
const EMBEDDING_ENGINE_URL = process.env.EMBEDDING_ENGINE_URL ?? "http://localhost:5053";
```

**Environment Variables (if not localhost):**

```bash
export SEARCH_API_URL=http://search-api:5050
export EMBEDDING_ENGINE_URL=http://embeddings:5053
export PORT=5051
```

**Start the gateway:**

```bash
cd torquequery-gateway
npm run dev
```

**Test all three search modes:**

```bash
# Keyword search (fast, structure-focused)
curl "http://localhost:5051/keyword?q=spawn"

# Semantic search (logic-focused)
curl "http://localhost:5051/semantic?q=how+does+the+pool+work"

# Hybrid search (balanced, default)
curl "http://localhost:5051/hybrid?q=WarmPoolManager"
```

**Expected:**
```json
{
  "query": "WarmPoolManager",
  "strategy": "hybrid",
  "count": 2,
  "results": [
    {
      "path": "src/agents/warmPoolAgent.ts",
      "repo": "castironforge",
      "language": "ts",
      "hybridScore": 0.892
    }
  ]
}
```

- [ ] API Gateway is running on :5051
- [ ] /keyword endpoint works (→ Search API)
- [ ] /semantic endpoint works (→ Embedding Engine)
- [ ] /hybrid endpoint works (fan-out + merge)

---

## Step 5: Verify Full Pipeline

**Test end-to-end without agents:**

```bash
# 1. Indexer has indexed files
curl -H "X-TYPESENSE-API-KEY: dev-key" \
  "http://localhost:8108/collections/code_files/documents/search?q=*" \
  | jq '.hits | length'
# Should return > 10

# 2. Search API queries Typesense
curl "http://localhost:5050/search?q=warmPool" | jq '.count'
# Should return > 0

# 3. Embedding Engine produces vectors
curl -X POST http://localhost:5053/embed \
  -d '{"text":"test"}' | jq '.embedding | length'
# Should return 384 or 768

# 4. API Gateway fuses results
curl "http://localhost:5051/hybrid?q=warmPool" | jq '.results | length'
# Should return > 0
```

**Expected Output:**
```
10+        # Typesense has indexed files
2+         # Search API finds results
384        # Embeddings have correct dimension
2+         # Gateway returns fused results
```

- [ ] Typesense has >10 indexed documents
- [ ] Search API returns results
- [ ] Embedding Engine produces vectors
- [ ] API Gateway merges and ranks results
- [ ] Full pipeline works end-to-end

---

## Step 6: Wire Agents (Tool Registry Integration)

**File:** `chat-agent/src/tools/registry.ts`

Agents call TorqueQuery via the registry:

```typescript
import { callTool } from "./tools/registry.js";

// Agents use this pattern:
const hits = await callTool("torque_query", "WarmPoolManager");
// → calls http://localhost:5051/hybrid?q=WarmPoolManager
```

**Verify Integration:**

Create `chat-agent/test-pipeline.ts`:

```typescript
import { callTool } from "./tools/registry.js";

async function testFullPipeline() {
  console.log("Testing full indexer → gateway → agent pipeline...\n");

  // Test code_search tool (via Search API)
  console.log("1. Testing code_search (Typesense)...");
  const codeHits = await callTool("code_search", "warmPool", {
    queryBy: "symbols"
  });
  console.log(`   Found ${codeHits.length} files via Typesense`);

  // Test torque_query tool (via API Gateway)
  console.log("\n2. Testing torque_query (Hybrid)...");
  const torqueHits = await callTool("torque_query", "WarmPoolManager", {
    mode: "hybrid"
  });
  console.log(`   Found ${torqueHits.length} files via Gateway`);
  if (torqueHits.length > 0) {
    console.log(`   Top result: ${torqueHits[0].path}`);
  }

  // Test agent grounding pattern
  console.log("\n3. Testing agent grounding pattern...");
  const query = "WarmPoolManager";
  const results = await callTool("torque_query", query);
  
  if (results.length > 0) {
    const answer = {
      grounded: true,
      query,
      file: results[0].path,
      repo: results[0].repo,
      score: results[0].hybridScore
    };
    console.log(`   ✓ Grounded answer: ${JSON.stringify(answer, null, 2)}`);
  } else {
    console.log(`   ✗ No results (not grounded)`);
  }
}

testFullPipeline().catch(console.error);
```

**Run the test:**

```bash
cd chat-agent
npx ts-node test-pipeline.ts
```

**Expected Output:**
```
Testing full indexer → gateway → agent pipeline...

1. Testing code_search (Typesense)...
   Found 2 files via Typesense

2. Testing torque_query (Hybrid)...
   Found 2 files via Gateway
   Top result: src/agents/warmPoolAgent.ts

3. Testing agent grounding pattern...
   ✓ Grounded answer: {
     "grounded": true,
     "query": "WarmPoolManager",
     "file": "src/agents/warmPoolAgent.ts",
     "repo": "castironforge",
     "score": 0.892
   }
```

- [ ] code_search tool works (via Search API)
- [ ] torque_query tool works (via API Gateway)
- [ ] Agent grounding pattern produces grounded: true
- [ ] Real file paths returned (no hallucinations)

---

## Step 7: Performance Validation

Ensure all performance targets are met:

```bash
# Keyword search (target: <20ms)
time curl -s "http://localhost:5051/keyword?q=spawn" > /dev/null
# Real:     ~10ms

# Semantic search (target: <100ms)
time curl -s "http://localhost:5051/semantic?q=how+do+browsers+spawn" > /dev/null
# Real:     ~60ms

# Hybrid search (target: <150ms)
time curl -s "http://localhost:5051/hybrid?q=WarmPoolManager" > /dev/null
# Real:     ~120ms
```

**Expected:**
- Keyword: <20ms ✓
- Semantic: <100ms ✓
- Hybrid: <150ms ✓

- [ ] Keyword search < 20ms
- [ ] Semantic search < 100ms
- [ ] Hybrid search < 150ms

---

## Troubleshooting

### Issue: Typesense returns empty results

**Cause:** Indexer hasn't ingested files yet.

**Fix:**
```bash
# Check indexer is running
cd typesense-indexer && npm run dev

# Wait 10-30 seconds for initial indexing
# Then check again
curl -H "X-TYPESENSE-API-KEY: dev-key" \
  "http://localhost:8108/collections/code_files/documents/search?q=*"
```

### Issue: Search API returns 500 error

**Cause:** Can't connect to Typesense.

**Fix:**
```bash
# Verify Typesense is running
curl http://localhost:8108/health

# If not, start it
docker-compose up typesense

# Then restart Search API
cd search-api && npm run dev
```

### Issue: API Gateway returns empty results

**Cause:** Backend services (Search API or Embedding Engine) not running.

**Fix:**
```bash
# Check all three are running
ps aux | grep -E "search-api|embeddings|gateway"

# If missing, start them in separate terminals:
cd search-api && npm run dev
cd torquequery-embeddings && npm run dev
cd torquequery-gateway && npm run dev
```

### Issue: Agent tool calls return no results

**Cause:** Registry not wired into agent initialization.

**Fix:**
```typescript
// In chat-agent/src/server.ts or agent init:
import { tools, toolSchemas } from "./tools/registry.js";

// Make tools available globally
global.agentTools = tools;
global.toolSchemas = toolSchemas;

// Agents can now call:
const hits = await callTool("torque_query", query);
```

---

## Deployment Configuration

For production or Docker deployment:

**docker-compose.yml:**

```yaml
version: "3"

services:
  typesense:
    image: typesense/typesense:latest
    ports:
      - "8108:8108"
    environment:
      TYPESENSE_API_KEY: ${TYPESENSE_API_KEY:-dev-key}

  search-api:
    build: ./search-api
    ports:
      - "5050:5050"
    environment:
      TYPESENSE_HOST: typesense
      TYPESENSE_PORT: 8108
      SERVER_PORT: 5050
    depends_on:
      - typesense

  torquequery-embeddings:
    build: ./torquequery-embeddings
    ports:
      - "5053:5053"
    environment:
      PORT: 5053

  torquequery-gateway:
    build: ./torquequery-gateway
    ports:
      - "5051:5051"
    environment:
      SEARCH_API_URL: http://search-api:5050
      EMBEDDING_ENGINE_URL: http://torquequery-embeddings:5053
      PORT: 5051
    depends_on:
      - search-api
      - torquequery-embeddings

  typesense-indexer:
    build: ./typesense-indexer
    environment:
      TYPESENSE_HOST: typesense
      TYPESENSE_PORT: 8108
      REPO_ROOT: /code
    volumes:
      - .:/code
    depends_on:
      - typesense
```

**Start all services:**

```bash
docker-compose up
```

---

## Final Verification Checklist

- [ ] Typesense collection `code_files` exists and has >10 documents
- [ ] Search API returns results for keyword queries
- [ ] Embedding Engine produces deterministic vectors
- [ ] API Gateway routes to all backends
- [ ] Keyword search: <20ms
- [ ] Semantic search: <100ms
- [ ] Hybrid search: <150ms
- [ ] Agent tool registry is integrated
- [ ] Agents can call `callTool("torque_query", query)`
- [ ] Agents receive grounded results with real file paths
- [ ] No errors in any service logs

---

## Next Steps

✅ **Pipeline Complete**

Your TorqueQuery indexer pipeline is now fully wired:

```
Files → Indexer → Typesense → Search API → Gateway → Agents
                                          ↘ Embeddings ↗
```

Agents can now:
- Query code deterministically
- Get real file paths (no hallucinations)
- Ground their reasoning in verified code

**Next phase (Phase 4, Week 2):** Add observability dashboard.

