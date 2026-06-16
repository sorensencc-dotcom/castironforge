# CIC Memory Spine — Overview

## What it is

The CIC Memory Spine is a single logical service that gives CIC agents deterministic, corpus-independent answers. It sits between reasoning LLMs and raw document storage, acting as a modular knowledge layer that can be trained, versioned, and hot-swapped without touching the LLM or the orchestrator routing logic.

## Why it exists

RAG at inference time has two failure modes for CIC:
- **Scale failure**: retrieval cost grows with corpus size; answers degrade as docs accumulate.
- **Fragility**: multi-hop reasoning over retrieved chunks is error-prone; agents burn context window on retrieval noise.

The Memory Spine removes both failure modes by precomputing answers into a compact model. Inference cost is fixed regardless of how large the CIC corpus grows.

## Architecture

```
CIC Agent
    │
    ▼
CIC Orchestrator (routing + confidence gating)
    │
    ▼
┌─────────────────────────────────┐
│       CIC Memory Spine          │
│                                 │
│  MemoryQuery  MemoryEdit        │
│  MemoryAdmin  MemoryProvenance  │
│                                 │
│  ┌────────────┐  ┌───────────┐  │
│  │Memory Model│  │FeatureStore│ │
│  └────────────┘  └───────────┘  │
│  ┌──────────────────────────┐   │
│  │     Corpus Store         │   │
│  └──────────────────────────┘   │
└─────────────────────────────────┘
    │
    ▼
TorqueQuery / Data Lake
(fallback + training corpus)
```

## Service boundaries

| Service | Responsibility |
|---|---|
| **MemoryQuery** | Deterministic knowledge lookup; returns answer + provenance + confidence |
| **MemoryEdit** | Add, update, or delete corpus documents; triggers version bump |
| **MemoryAdmin** | Version management; activate, rollback, status |
| **MemoryProvenance** | Trace doc lineage across memory versions |

## Core design principles

- **Reasoning frozen, memory modular**: LLM is never fine-tuned for CIC knowledge. Only the memory model changes.
- **Fixed inference cost**: precomputed answers; no corpus-scale search at runtime.
- **LLM-agnostic API**: any model that can call tools can use the Spine.
- **Hot-swap without downtime**: memory-vN artifacts are activated via MemoryAdmin; rollback in <1 second.
- **Confidence-gated fallback**: if confidence < threshold, orchestrator falls back to TorqueQuery or direct RAG.

## Component map

| Component | Role |
|---|---|
| Memory Model | 1–3B transformer trained on CIC corpus; outputs answer + provenance tokens |
| Feature Store | Embeddings, sparse features, document graph |
| Corpus Store | Versioned, chunked documents with metadata |
| Memory Router | Domain-aware, version-aware, confidence-aware dispatch |

## Related docs

- [API.md](./API.md) — full endpoint contracts
- [AGENT_CALL_PATTERNS.md](./AGENT_CALL_PATTERNS.md) — how agents use the Spine
- [TRAINING_PIPELINE.md](./TRAINING_PIPELINE.md) — how memory models are built
- [VERSIONING.md](./VERSIONING.md) — memory-vN scheme and rollback
- [DEPLOYMENT.md](./DEPLOYMENT.md) — topology and node layout
- [ORCHESTRATOR_PATCH.md](./ORCHESTRATOR_PATCH.md) — wiring into CIC Orchestrator
