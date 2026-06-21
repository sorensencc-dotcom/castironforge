# Phase 29 — Autonomous Corpus Expansion and Reindexing

Phase 29 transforms CIC from a passive repository into an autonomous system that detects gaps, proposes solutions, and self-heals through orchestrated maintenance workflows.

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│         Corpus Intelligence (Phase 27)                   │
│  - Integrity checks                                      │
│  - Drift detection                                       │
│  - Recommendations engine                                │
└────────────────────┬─────────────────────────────────────┘
                     │
        ┌────────────▼────────────┐
        │ Autonomous Expansion    │
        │ Decision Engine         │
        └────────────┬────────────┘
                     │
    ┌────────────────┼────────────────┐
    │                │                │
    ▼                ▼                ▼
┌─────────┐  ┌──────────────┐  ┌─────────────┐
│Reindexer│  │Reembedder    │  │Ingestion    │
│         │  │              │  │Orchestrator │
└────┬────┘  └──────┬───────┘  └──────┬──────┘
     │              │                 │
     └──────────────┼─────────────────┘
                    │
        ┌───────────▼──────────┐
        │ Distributed MinIO    │
        │ (Phase 28)           │
        └──────────────────────┘
```

## Core Systems

### 1. Decision Engine
- Consumes recommendations from Phase 27
- Prioritizes actions (REINDEX, REEMBED, FIX_METADATA, EXPAND_CORPUS)
- Manages workflow execution
- Tracks completion and failures

### 2. Reindexer
- Detects documents that need reindexing
- Extracts content from raw documents
- Re-indexes in Typesense with updated metadata
- Tracks reindex completion

### 3. Reembedder
- Detects stale or missing embeddings
- Generates new embeddings via EmbeddingService
- Upserts to Qdrant with latest metadata
- Manages batch operations

### 4. Ingestion Orchestrator
- Detects underrepresented phases/adapters
- Proposes ingestion targets
- Coordinates with external sources
- Triggers intelligent corpus expansion

### 5. Workflow Manager
- Coordinates multi-step operations
- Handles retries and backoff
- Tracks workflow state
- Reports completion

## Workflow Examples

### Workflow: REINDEX
```
1. Get document from MinIO
2. Extract content via Tika
3. Update tags via TagExtractor
4. Upsert to Typesense
5. Update Qdrant payload
6. Mark complete
```

### Workflow: REEMBED
```
1. Get document from MinIO
2. Extract text content
3. Generate embedding via EmbeddingService
4. Upsert to Qdrant with new vector
5. Mark complete
```

### Workflow: FIX_METADATA
```
1. Get document metadata
2. Extract phase/adapter from content
3. Update in Typesense
4. Update in Qdrant payload
5. Mark complete
```

### Workflow: EXPAND_CORPUS
```
1. Analyze phase gap (e.g., Phase-25 has 2 docs, needs 5+)
2. Query knowledge base for Phase-25 content
3. Ingest missing documents
4. Update corpus inventory
5. Report expansion complete
```

## Autonomy Levels

### Level 1: Recommended
- Surfaces recommendations to dashboard
- Awaits human approval
- Executes approved workflows

### Level 2: Trusted (Default)
- Executes low-risk workflows automatically
  - REINDEX (already-indexed docs)
  - REEMBED (regenerate embeddings)
  - FIX_METADATA (tag updates)
- Requires approval for EXPAND_CORPUS

### Level 3: Autonomous
- Executes all workflows automatically
- Self-healing corpus
- Minimal human oversight

## Deliverables

A. **Decision Engine**
- Recommendation consumer
- Workflow prioritization
- Action orchestration

B. **Reindexer**
- Content extraction
- Metadata tagging
- Typesense updates

C. **Reembedder**
- Batch embedding generation
- Vector updates
- Qdrant synchronization

D. **Ingestion Orchestrator**
- Gap detection
- Source identification
- Automated ingestion

E. **Workflow Manager**
- State tracking
- Retry logic
- Completion reporting

F. **Observability**
- Prometheus metrics
- Workflow dashboards
- Event logging

## Outcome

CIC becomes:
- ✅ **Self-aware** (Phase 27) + **Resilient** (Phase 28) + **Self-healing** (Phase 29)
- ✅ Detects corpus problems automatically
- ✅ Executes maintenance workflows autonomously
- ✅ Expands corpus to fill gaps
- ✅ Regenerates indices/embeddings when stale
- ✅ Maintains consistent metadata across layers

This is the foundation for Phase 30 (distributed decision-making across agents).
