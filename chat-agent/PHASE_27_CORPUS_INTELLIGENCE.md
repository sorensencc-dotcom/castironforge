# Phase 27+ Corpus Intelligence

Phase 27+ is where CIC becomes a self-aware corpus system. This document describes the Corpus Intelligence Layer—a unified subsystem that enables CIC to understand, maintain, and reason about its own corpus.

## Overview

The Corpus Intelligence Layer consists of two complementary capabilities:

1. **Phase/Adapter Tagging** — Structural intelligence that classifies documents by phase, adapter, and subsystem
2. **Corpus Introspection** — Awareness intelligence that detects drift, integrity issues, and coverage gaps

Together, they transform the corpus into a queryable, self-diagnosing, self-maintaining knowledge substrate.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              Corpus Intelligence API                         │
│  (/corpus/summary, /corpus/integrity, /corpus/drift, ...)   │
└────────────────┬────────────────────────────────────────────┘
                 │
    ┌────────────┼────────────┐
    │            │            │
    ▼            ▼            ▼
┌─────────┐  ┌────────┐  ┌─────────────┐
│Integrity│  │ Drift  │  │Corpus       │
│Checker  │  │Detector│  │Summary      │
└────┬────┘  └────┬───┘  │Builder      │
     │            │      └────┬────────┘
     │            │           │
     └────────────┼───────────┘
                  │
         ┌────────┴────────┐
         │                 │
    ┌────▼────┐      ┌─────▼──────────┐
    │Typesense│      │Recommendations │
    │(indexed)│      │Engine          │
    └─────────┘      └─────────────────┘
         │
    ┌────┴─────────────────────────────┐
    │                                   │
┌───▼────────┐                  ┌──────▼──────┐
│MinIO       │                  │Qdrant       │
│(raw docs)  │                  │(embeddings) │
└────────────┘                  └─────────────┘
```

## Components

### 1. Tag Extraction (TagExtractor.ts)

Deterministic tag extraction with strict precedence:

```
1. Explicit caller-provided tags (highest priority)
2. Embedded tags in document text (@phase-27, @adapter:WarmPool)
3. Repo/path heuristics (phases/27/..., adapters/warm-pool/...)
4. Tika metadata hints
5. Subsystem inference (file path patterns)
```

#### Usage

```typescript
import { extractTags } from "./corpus/tags/TagExtractor";

const tags = extractTags({
  repo: "castironforge",
  path: "phases/27/adapter-integration/...",
  text: "Document content with @phase-27 and @adapter:WarmPool",
  metadata: { phase: "27" },
  explicitPhase: "27",
  explicitAdapter: "WarmPool"
});

// Output: { phase: "27", adapter: "WarmPool", subsystem: "adapters" }
```

### 2. Integrity Checker (IntegrityChecker.ts)

Verifies consistency across MinIO → Typesense → Qdrant:

- **MISSING_INDEX**: Document in MinIO but not in Typesense
- **MISSING_VECTOR**: Document in Typesense but not in Qdrant
- **HASH_MISMATCH**: SHA256 mismatch between raw and indexed
- **MISSING_METADATA**: Missing phase/adapter tags

#### Usage

```typescript
const checker = new IntegrityChecker();
const issues = await checker.run();

// Output
[
  { id: "doc-123", type: "MISSING_VECTOR" },
  { id: "doc-456", type: "HASH_MISMATCH", details: { raw: "...", indexed: "..." } }
]
```

### 3. Drift Detector (DriftDetector.ts)

Detects inconsistencies between layers:

- **RAW_CHANGED**: Raw doc changed but index not updated
- **EMBEDDING_STALE**: Embedding doesn't match raw doc
- **METADATA_STALE**: Metadata inconsistent between Typesense and Qdrant

#### Usage

```typescript
const detector = new DriftDetector();
const issues = await detector.run();

// Output
[
  { id: "doc-789", type: "EMBEDDING_STALE", details: { raw: "...", embedded: "..." } }
]
```

### 4. Corpus Summary Builder (CorpusSummary.ts)

Aggregates corpus statistics:

```typescript
const builder = new CorpusSummaryBuilder();
const summary = await builder.run();

// Output
{
  byPhase: { "27": 42, "26": 18, "25": 5 },
  byAdapter: { "WarmPool": 30, "CloakBrowser": 25 },
  bySubsystem: { "ingestion": 40, "memory": 20 },
  totalDocs: 65,
  timestamp: "2026-06-21T..."
}
```

### 5. Recommendations Engine (RecommendationsEngine.ts)

Generates actionable maintenance tasks:

- **REINDEX**: Documents with hash mismatches
- **REEMBED**: Stale or missing embeddings
- **FIX_METADATA**: Missing phase/adapter tags
- **EXPAND_CORPUS**: Underrepresented phases/adapters

```typescript
const engine = new RecommendationsEngine();
const recs = await engine.run();

// Output
[
  { action: "REINDEX", id: "doc-123", reason: "Hash mismatch", priority: "HIGH" },
  { action: "EXPAND_CORPUS", target: "phase-25", reason: "Underrepresented", priority: "LOW" }
]
```

## API Endpoints

### GET /corpus/summary

Returns corpus statistics by phase, adapter, subsystem.

```bash
curl http://localhost:8000/api/corpus/summary
```

### GET /corpus/integrity

Returns integrity issues across MinIO, Typesense, Qdrant.

```bash
curl http://localhost:8000/api/corpus/integrity
```

### GET /corpus/drift

Returns drift issues between raw, indexed, and embedded states.

```bash
curl http://localhost:8000/api/corpus/drift
```

### GET /corpus/recommendations

Returns actionable maintenance recommendations.

```bash
curl http://localhost:8000/api/corpus/recommendations
```

### GET /corpus/health

Returns overall corpus health status.

```bash
curl http://localhost:8000/api/corpus/health
```

## MCP Tools

Agents can use these tools for corpus reasoning:

- **corpusSummary**: Get high-level corpus stats
- **corpusIntegrity**: Check corpus integrity
- **corpusDrift**: Detect drift between layers
- **corpusRecommendations**: Get maintenance recommendations
- **corpusHealth**: Get overall corpus health

## Integration Points

### 1. Ingestion Pipeline

Wire tag extraction into the Tika → TorqueQuery bridge:

```typescript
import { extractTags } from "./corpus/tags/TagExtractor";

// In ingestion service
const tags = extractTags({
  repo,
  path,
  text,
  metadata,
  explicitPhase: opts.phase,
  explicitAdapter: opts.adapter
});

// Store in Typesense document
typesenseDoc.phase = tags.phase;
typesenseDoc.adapter = tags.adapter;
typesenseDoc.subsystem = tags.subsystem;

// Store in Qdrant payload
qdrantPoint.payload.phase = tags.phase;
qdrantPoint.payload.adapter = tags.adapter;
```

### 2. Dashboard/Observability

Expose corpus health via Prometheus metrics:

- `corpus_docs_total` — Total documents by phase/adapter
- `corpus_integrity_issues_total` — Integrity issues by type
- `corpus_drift_issues_total` — Drift issues by type
- `corpus_health_status` — Overall health (1 = HEALTHY, 0 = NEEDS_ATTENTION)

## Phase 27+ Outcome

CIC becomes:

- **Self-aware**: Knows what it contains (corpus inventory)
- **Self-diagnosing**: Detects drift, gaps, and inconsistencies
- **Self-maintaining**: Suggests or triggers reindexing/re-embedding
- **Phase-aware**: Documents tied to CIC roadmap phases
- **Adapter-aware**: Documents tied to subsystem adapters

This is the foundation for:

- **Phase 28**: Distributed MinIO with cross-datacenter sync
- **Phase 29**: Autonomous corpus expansion and reindexing
- **Phase 30**: Self-healing storage with conflict resolution

## Next Steps

1. **Integration**: Wire tag extraction into the ingestion pipeline
2. **Monitoring**: Expose metrics to Prometheus/Grafana
3. **Automation**: Connect recommendations engine to orchestrator for autonomous maintenance
4. **Extension**: Add schema-aware validation for corpus integrity
