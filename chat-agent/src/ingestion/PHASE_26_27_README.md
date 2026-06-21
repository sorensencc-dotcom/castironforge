# Phase 26/27: Complete Ingestion → Indexing → Retrieval Pipeline

This document describes the complete, production-ready CIC ingestion and retrieval pipeline.

## Architecture

```
Tika (or other source)
    ↓
[1] ingestDocumentToTorqueQuery()
    ├─ Compute SHA256 hash
    ├─ Store raw to MinIO (cic-torquequery-raw)
    ├─ Generate embedding
    ├─ Index to Typesense (BM25)
    └─ Index to Qdrant (semantic)
    ↓
Agent: searchDocuments()
    ├─ Keyword search (Typesense)
    ├─ Semantic search (Qdrant)
    ├─ Hybrid fusion
    └─ Return ranked results
```

## Components

### 1. Embedding Service (`services/embeddingService.ts`)

**Provider Abstraction:**
- OpenAI (default, production)
- Ollama (local, future)
- Extensible for other backends

```typescript
import { embeddingProvider } from './services/embeddingService';

// Single embedding
const embedding = await embeddingProvider.embed('text');

// Batch embeddings
const embeddings = await embeddingProvider.embedBatch(['text1', 'text2']);

// Get dimensionality
const dims = embeddingProvider.dimensionality(); // 3072 for OpenAI
```

**Environment Variables:**
```bash
EMBEDDING_PROVIDER=openai  # or 'ollama'
OPENAI_API_KEY=...
OLLAMA_URL=http://localhost:11434
```

### 2. Tika → TorqueQuery Bridge (`ingestion/bridges/tikaToTorqueQuery.ts`)

**Complete Ingestion Pipeline:**

```typescript
import { ingestDocumentToTorqueQuery } from './ingestion/bridges/tikaToTorqueQuery';

const result = await ingestDocumentToTorqueQuery({
  repo: 'castironforge',
  path: 'chat-agent/src/server.ts',
  text: '...',
  rawBuffer: Buffer.from('...'),
  metadata: {
    title: 'CIC Chat Agent Server',
    Author: 'Chris',
    'Content-Type': 'text/typescript',
    Keywords: 'tika,embedding,torque'
  },
  phase: '26',
  adapter: 'torque'
});

// Returns:
{
  id: 'castironforge:chat-agent/src/server.ts',
  repo: 'castironforge',
  path: 'chat-agent/src/server.ts',
  sha256: 'a1b2c3d4...',
  minioKey: 'castironforge/a1b2c3d4/chat-agent/src/server.ts',
  embeddingDims: 3072,
  indexed: {
    typesense: true,  // BM25 keyword index
    qdrant: true      // Semantic vector index
  },
  timestamp: '2026-06-21T14:50:00Z'
}
```

**What Happens:**
1. Compute deterministic SHA256 hash of raw content
2. Store raw document to MinIO (`cic-torquequery-raw` bucket)
3. Generate embedding via provider (OpenAI or Ollama)
4. Index into Typesense (keyword search, BM25)
5. Index into Qdrant (semantic search, vector similarity)
6. Return deterministic result

**Key Properties:**
- ✅ **Reproducible** — Same input always produces same SHA256
- ✅ **Durable** — Raw stored in MinIO
- ✅ **Hybrid-searchable** — Both keyword and semantic
- ✅ **Metadata-rich** — Full extraction from Tika
- ✅ **Phase/Adapter-tagged** — For filtering

### 3. Hybrid Document Search Tool (`mcp/tools/documentSearch.ts`)

**Agent-Side Search:**

```typescript
import { searchDocuments } from './mcp/tools/documentSearch';

const results = await searchDocuments({
  query: 'how does the ingestion pipeline work?',
  repo: 'castironforge',
  phase: '26',
  limit: 10
});

// Returns:
{
  query: 'how does the ingestion pipeline work?',
  results: [
    {
      id: 'castironforge:chat-agent/src/ingestion/bridges/tikaToTorqueQuery.ts',
      repo: 'castironforge',
      path: 'chat-agent/src/ingestion/bridges/tikaToTorqueQuery.ts',
      title: 'Tika to TorqueQuery Bridge',
      author: 'Chris',
      sha256: 'a1b2c3d4...',
      score: 0.87,
      scoreBreakdown: {
        bm25: 0.92,    // Keyword match strength
        semantic: 0.83 // Semantic relevance
      }
    },
    // ... more results
  ],
  count: 8,
  duration: 245  // milliseconds
}
```

**Search Strategy:**
1. Embed query using same provider as documents
2. Perform keyword search in Typesense (BM25)
3. Perform semantic search in Qdrant (vector similarity)
4. Hybrid fusion (normalize + weighted sum)
5. Return ranked results with score breakdown

**Filters:**
- `repo` — Repository name
- `phase` — CIC phase (e.g., "26", "27")
- `adapter` — Adapter type (e.g., "torque", "ollama")
- `limit` — Maximum results (default: 10)

## Integration Points

### Registration

Add to MCP server:
```typescript
import { documentSearchTool } from './mcp/tools/documentSearch';

mcpTools.register(documentSearchTool);
```

### Orchestration Endpoints

Add to orchestration router:
```typescript
POST /orchestration/corpus/ingest
{
  "repo": "castironforge",
  "path": "file.ts",
  "text": "...",
  "rawBuffer": "...",
  "metadata": {},
  "phase": "26",
  "adapter": "torque"
}

POST /orchestration/corpus/search
{
  "query": "...",
  "repo": "castironforge",
  "limit": 10
}
```

## Configuration

### Environment Variables

```bash
# Embedding provider
EMBEDDING_PROVIDER=openai  # or 'ollama'

# OpenAI
OPENAI_API_KEY=sk-...

# Ollama (if local)
OLLAMA_URL=http://localhost:11434

# Storage
MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_ACCESS_KEY=cic
MINIO_SECRET_KEY=cic-secret

# Typesense (placeholder)
TYPESENSE_URL=http://localhost:8108
TYPESENSE_API_KEY=...

# Qdrant (placeholder)
QDRANT_URL=http://localhost:6333
```

## Monitoring

**Metrics:**
- Documents ingested (per hour)
- Embedding time (latency)
- Indexing failures
- Search latency
- Corpus size (MinIO bucket stats)

**Health Checks:**
- `/corpus/health` — Pipeline status
- `/corpus/integrity` — MinIO ↔ TorqueQuery alignment
- `/storage/torquequery/info` — Corpus statistics

## Testing

### Ingest a Document

```bash
curl -X POST http://localhost:8000/orchestration/corpus/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "repo": "test",
    "path": "example.txt",
    "text": "Sample document content",
    "rawBuffer": "U2FtcGxlIGRvY3VtZW50IGNvbnRlbnQ=",
    "phase": "26"
  }'
```

### Search Documents

```bash
curl -X POST http://localhost:8000/orchestration/corpus/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "document content",
    "repo": "test",
    "limit": 5
  }'
```

### Check Corpus Integrity

```bash
curl http://localhost:8000/orchestration/corpus/integrity
```

## Future Extensions

### Phase 28: Distributed MinIO
- Multi-node MinIO cluster
- Erasure coding (durability)
- Automatic replication

### Phase 29: Self-Healing Ingestion
- Bit-rot detection
- Automatic re-embedding
- Corpus reconciliation

### Phase 30: Autonomous Corpus Expansion
- Agents autonomously discover sources
- Continuous ingestion
- Dynamic re-weighting

## References

- [Embedding Service](./services/embeddingService.ts)
- [Tika Bridge](./ingestion/bridges/tikaToTorqueQuery.ts)
- [Document Search Tool](./mcp/tools/documentSearch.ts)
- [Hybrid Fusion](./services/hybridFusion.ts)
