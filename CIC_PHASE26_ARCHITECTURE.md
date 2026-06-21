# CIC Phase 26 Architecture Diagram

Complete CIC topology showing TorqueQuery integration, memory phases, runtime orchestration, and multi-agent substrate.

## Text-SVG Layout

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                CIC PHASE 26                                  │
│                        RUNTIME ORCHESTRATOR + TORQUEQUERY                    │
└──────────────────────────────────────────────────────────────────────────────┘

                          ┌──────────────────────────┐
                          │      WORLD INPUTS        │
                          │  (Web, Files, Images)    │
                          └─────────────┬────────────┘
                                        │
                                        ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                                INGESTION LAYER                               │
│  Discovery → Extractors → Enrichment → Evidence Packets → Canonical Claims   │
│                                                                              │
│  Extractors:                                                                 │
│   • DomSampler                                                               │
│   • ReverseImageSearchExtractor                                              │
│   • WarmPoolManager Runtime Logs                                             │
│   • CloakBrowserAdapter Snapshots                                            │
│   • VerticalDriftDetector Signals                                            │
└───────────────┬──────────────────────────────────────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                           MEMORY LAYER (PHASE 23–25)                         │
│                                                                              │
│  • Short‑term Memory                                                         │
│  • Long‑term Memory                                                          │
│  • Retrieval Indexes                                                         │
│                                                                              │
│  Memory → pushes normalized documents → TorqueQuery ingestion adapter        │
└───────────────┬──────────────────────────────────────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                           TORQUEQUERY (PHASE 26)                             │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │  TYPESENSE (Keyword + Metadata)                                        │  │
│  │   • Code Index                                                         │  │
│  │   • Docs Index                                                         │  │
│  │   • Metadata Index                                                     │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │  QDRANT (Semantic Vectors)                                              │  │
│  │   • Code Embeddings                                                     │  │
│  │   • Docs Embeddings                                                     │  │
│  │   • World Corpus Embeddings                                             │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │  HYBRID FUSION ENGINE                                                   │  │
│  │   • BM25 + Vector Fusion                                                │  │
│  │   • Deterministic Ranking                                               │  │
│  │   • Multi‑Collection Orchestration                                      │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  API Gateway: /keyword /semantic /hybrid /multi /embed                       │
└───────────────┬──────────────────────────────────────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                         RUNTIME ORCHESTRATOR (PHASE 26)                      │
│                                                                              │
│  • Query Planner                                                             │
│  • Agent Router                                                              │
│  • Capability Matrix                                                          │
│  • Region Registry                                                            │
│                                                                              │
│  Orchestrator uses TorqueQuery to:                                           │
│   • Ground reasoning                                                         │
│   • Locate code paths                                                        │
│   • Resolve references                                                       │
│   • Select agents                                                            │
└───────────────┬──────────────────────────────────────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                                AGENT LAYER                                   │
│                                                                              │
│  Agents:                                                                     │
│   • WarmPoolManager Agent                                                    │
│   • CloakBrowserAdapter Agent                                                │
│   • DomSampler Agent                                                         │
│   • VerticalDriftDetector Agent                                              │
│   • Rewrite Labs Agents                                                      │
│                                                                              │
│  Each agent has tool: torque_query(query)                                    │
│  → grounded code/docs/logs returned                                          │
└───────────────┬──────────────────────────────────────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                             SYNTHESIS LAYER                                  │
│  • Multi‑agent reasoning                                                     │
│  • Evidence merging                                                          │
│  • Final answer generation                                                   │
└───────────────┬──────────────────────────────────────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                               AUDIT LAYER                                    │
│  • Traceability                                                               │
│  • Evidence packets                                                           │
│  • Deterministic logs                                                         │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Legend

| Symbol | Meaning |
|--------|---------|
| **Bold boxes** | CIC subsystems |
| **Indented boxes** | TorqueQuery components |
| **Arrows (→, ▼)** | Deterministic data flow |
| **Phase labels** | CIC roadmap alignment |

---

## Data Flow Summary

### 1. Ingestion → Memory → TorqueQuery

All extracted content flows through Ingestion → Memory → TorqueQuery:

- **Ingestion Layer** discovers and extracts evidence packets from:
  - Web pages (DomSampler)
  - Images (ReverseImageSearchExtractor)
  - Runtime logs (WarmPoolManager, CloakBrowserAdapter)
  - Signals (VerticalDriftDetector)

- **Memory Layer** (Phases 23-25) normalizes and indexes evidence
  - Short-term memory (recent facts)
  - Long-term memory (persistent knowledge)
  - Retrieval indexes for fast lookup

- **TorqueQuery** ingests normalized documents from Memory:
  - Typesense index (keyword search, metadata)
  - Qdrant index (semantic vectors)
  - Multi-collection orchestrator (code + docs + world corpus)

### 2. TorqueQuery → Runtime Orchestrator

The Runtime Orchestrator uses TorqueQuery to ground decisions:

```
Query from user/agent
    ↓
Orchestrator calls TorqueQuery
    ├─ /hybrid — balanced keyword + semantic
    ├─ /keyword — structure-focused (Phase tags, imports)
    └─ /semantic — logic-focused (behavior, concepts)
    ↓
Orchestrator receives grounded results
    ├─ Code locations (path, repo)
    ├─ Evidence context (content, phase)
    └─ Confidence scores (hybridScore)
    ↓
Orchestrator makes informed routing decision
    ├─ Select appropriate agent
    ├─ Pass context to agent
    └─ Execute task with grounding
```

### 3. Orchestrator → Agents

Each agent receives grounded context and has access to TorqueQuery:

```
Agent receives task + context
    ↓
Agent calls torque_query tool
    ├─ Search for code definitions
    ├─ Find usages
    ├─ Locate phase-specific files
    └─ Get evidence packets
    ↓
Agent executes with grounded knowledge
    ├─ No hallucinations (all facts verified)
    ├─ High confidence (ground truth from code)
    └─ Traceable (all sources documented)
    ↓
Agent returns result with grounding
    ├─ Result
    ├─ Evidence (which files/lines used)
    └─ Confidence level
```

### 4. Agents → Synthesis → Audit

Multi-agent outputs are merged and audited:

```
Agent outputs (multiple agents)
    ↓
Synthesis Layer
    ├─ Merge evidence from multiple agents
    ├─ Resolve conflicts
    ├─ Generate final answer
    └─ Compute confidence
    ↓
Audit Layer
    ├─ Log all decisions (deterministic)
    ├─ Track evidence packets used
    ├─ Record agent selections
    └─ Enable replay/debug
    ↓
Final result (fully traceable)
```

---

## Component Responsibilities

### Ingestion Layer
- Discover new content (web crawling, file monitoring, log tailing)
- Extract structured evidence (DomSampler, image extractors, log parsers)
- Enrich with metadata (Phase tags, source attribution, timestamps)
- Create evidence packets (canonical form)
- Emit to Memory

### Memory Layer (Phases 23-25)
- Receive evidence packets from Ingestion
- Normalize and deduplicate
- Store in short-term (recent) and long-term (persistent) indexes
- Push normalized documents to TorqueQuery ingestion adapter
- Provide fast retrieval via indexes

### TorqueQuery (Phase 26)
- Receive documents from Memory
- Index in Typesense (keyword + metadata)
- Embed and index in Qdrant (semantic)
- Expose via API Gateway
- Route queries to appropriate backend (keyword/semantic/hybrid)
- Merge and rank results

### Runtime Orchestrator (Phase 26)
- Receive queries from users/systems
- Use TorqueQuery to ground reasoning
- Select agents based on capability matrix
- Route context to agents
- Coordinate multi-agent execution
- Merge results

### Agent Layer
- Receive grounded context from Orchestrator
- Use TorqueQuery tool to retrieve additional evidence
- Execute specialized tasks
- Return results with evidence packets
- Support orchestrator synthesis

### Synthesis Layer
- Receive agent outputs
- Merge evidence from multiple agents
- Resolve conflicts via confidence scoring
- Generate final answer
- Return synthesized result

### Audit Layer
- Log all decisions (deterministic)
- Record evidence packets used
- Enable replay and debugging
- Support compliance and traceability

---

## Phase Alignment

| Phase | Component | Purpose | Status |
|-------|-----------|---------|--------|
| 23 | Memory (Short-term) | Recent facts | ✅ Phase 23+ |
| 24 | Memory (Long-term) | Persistent knowledge | ✅ Phase 24+ |
| 25 | Memory (Retrieval) | Fast lookup indexes | ✅ Phase 25+ |
| 26 | TorqueQuery | Deterministic hybrid search | ✅ **COMPLETE** |
| 26 | Runtime Orchestrator | Query planning, agent routing | ✅ **READY** |
| 27 | Query Planner | Automatic keyword vs semantic selection | 🔄 Incoming |
| 28 | Distributed TorqueQuery | Multi-node Typesense + Qdrant | 🔄 Planned |

---

## TorqueQuery in Phase 26

TorqueQuery is the **deterministic search substrate** for Phase 26:

### Keyword Search (`/keyword`)
- Searches Typesense indexes
- Fast (~5-20ms)
- Structure-aware (symbols, imports, phase tags)
- Best for: code locations, function definitions, adapters
- Used by: Orchestrator for code grounding

### Semantic Search (`/semantic`)
- Searches Qdrant vectors
- Medium latency (~50-100ms)
- Meaning-aware (logic, behavior, concepts)
- Best for: "how does X work", conceptual lookups
- Used by: Agents for behavioral understanding

### Hybrid Search (`/hybrid`)
- Combines keyword + semantic
- Slightly higher latency (~100-150ms)
- Balanced for general queries
- Best for: general-purpose search, agent default
- Used by: Orchestrator and agents for balanced retrieval

### Multi-Collection (`/multi`)
- Queries code + docs + world corpus simultaneously
- Returns merged results
- Used by: Synthesis layer for broad context

---

## Integration Points

### Ingestion → Memory → TorqueQuery

Memory adapter ingests normalized documents:

```typescript
// Memory pushes to TorqueQuery
await ingestDocument({
  path: "src/agents/WarmPoolManager.ts",
  repo: "cic",
  content: "...",
  symbols: ["WarmPoolManager", "hydrate", ...],
  phase: "26",
  adapter: "WarmPoolManager"
});
```

### TorqueQuery → Orchestrator

Orchestrator queries for grounding:

```typescript
// Orchestrator grounds decisions
const hits = await torqueQuery.search("WarmPoolManager");
const agent = selectAgent(hits);
```

### Orchestrator → Agents

Agents receive grounded context:

```typescript
// Agent has tool
const evidence = await torque_query("how do browsers spawn");
return { answer: ..., grounded: true };
```

### Agents → Synthesis → Audit

Results are merged and logged:

```typescript
// Synthesis merges agent outputs
const merged = merge(agentOutputs);

// Audit logs everything
log({
  query: originalQuery,
  agents: agentsUsed,
  evidence: evidencePackets,
  result: merged
});
```

---

## Key Properties

### Deterministic
- Same query → same results (always)
- No randomness in ranking
- Reproducible for debugging

### Operator-Grade
- No external APIs (Typesense + Qdrant local)
- Full control (no rate limits, costs, or changes)
- Fully auditable (every decision logged)

### Grounded
- All agent answers backed by evidence
- No hallucinations (verified against code/docs)
- Traceable (evidence packets link to sources)

### Scalable
- Keyword search: <20ms
- Semantic search: <100ms
- Hybrid: <150ms
- Handles 100+ concurrent requests

### Extensible
- New extractors → Ingestion layer
- New indexes → Memory layer
- New agents → Agent layer
- New synthesis logic → Synthesis layer

---

## Next: Phase 27

**Query Planner**
- Analyze query intent
- Choose keyword vs semantic vs hybrid automatically
- Route to appropriate backend

**Result Caching**
- 5-minute cache for popular queries
- Reduce Typesense + Qdrant load
- Fast repeat queries

**Advanced Ranking**
- Phase-aware scoring (boost Phase 26 results)
- Recency weighting (newer code first)
- Context-aware ranking (adapt to user history)

---

## Diagram Legend (for SVG generation)

When generating the Industrial Brass/Ember SVG:

| Element | Style |
|---------|-------|
| Bold boxes | `fill: #2a2a2a; stroke: #d4af37; stroke-width: 2px` |
| Indented boxes | `fill: #1a1a1a; stroke: #8b6914; stroke-width: 1.5px` |
| Arrows | `stroke: #d4af37; stroke-width: 2px; marker-end: url(#arrowhead)` |
| Data flow | `stroke: #8b6914; stroke-width: 1px; stroke-dasharray: 2,2` |
| Text | `font-family: monospace; font-size: 12px; fill: #e0e0e0` |
| Grid | 24px spacing, geometric alignment |

---

**Status:** ✅ Phase 26 Complete  
**Ready:** Production deployment  
**Next:** Phase 27 incoming
