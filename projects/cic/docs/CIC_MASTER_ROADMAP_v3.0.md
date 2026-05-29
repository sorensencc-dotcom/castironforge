# File: projects/cic/docs/CIC_MASTER_ROADMAP_v3.0.md

# Path: projects/cic/docs/CIC_MASTER_ROADMAP_v3.0.md

# Purpose: Master roadmap for CIC (Cast Iron Charlie) — v3.0 architecture

# ============================================================

# CAST IRON CHARLIE — MASTER ROADMAP (v3.0)

# ============================================================

## 1. OVERVIEW

CIC v3.0 is a deterministic, multi‑agent documentary research engine designed to:

- ingest heterogeneous sources
- enrich them with semantic metadata
- compress them into structured evidence
- canonicalize cross‑source claims
- synthesize narratives
- audit outputs for factual alignment

This roadmap defines:

- milestones
- module responsibilities
- integration points
- future expansions
- testing + reliability requirements

---

## 2. CURRENT STATE (as of v3.0)

All core modules are implemented:

```
INGEST → ENRICH → COMPRESS → ORCHESTRATE → SYNTHESIZE → AUDIT
```

All agents are implemented:

```
ingestion_agent
enrichment_agent
compression_agent
orchestrator_agent
synthesis_agent
audit_agent
```

All pipelines are implemented:

```
pipeline_ingest
pipeline_enrich
pipeline_compress
pipeline_full
```

All documentation is implemented:

```
CIC_SYSTEM.md
CIC_AGENT_CONTRACTS.md
CIC_PIPELINE_FLOW.md
```

CIC is now a fully functional, end‑to‑end research engine.

---

## 3. ROADMAP PHASES

### PHASE 1 — CORE PIPELINE (COMPLETE)

- ingestion module
- enrichment module
- compression subsystem
- cross‑source canonicalization
- orchestrator decision graph
- synthesis engine
- audit engine
- model router
- agent layer
- pipeline harness
- system documentation

Status: **100% complete**

---

### PHASE 2 — RELIABILITY + TESTING (NEXT)

#### 2.1 Unit Tests

Add full coverage under:

```
projects/cic/tests/core/
projects/cic/tests/agents/
projects/cic/tests/pipelines/
```

Coverage targets:

- 90%+ for deterministic modules
- 70%+ for model‑dependent modules (mocked)

#### 2.2 Integration Tests

End‑to‑end tests for:

- ingest → enrich
- enrich → compress
- compress → orchestrate
- orchestrate → synthesize → audit

#### 2.3 Golden Files

Store canonical outputs for regression testing.

---

### PHASE 3 — PERFORMANCE + SCALING

#### 3.1 Batch Processing

Add batch pipeline:

```
pipeline_batch.py
```

Supports:

- multiple topics
- parallel ingestion
- parallel compression

#### 3.2 Caching Layer Expansion

Extend cross‑source cache to:

- document compression
- image compression
- timeline compression

#### 3.3 Async Execution

Move ingestion + enrichment to async for speed.

---

### PHASE 4 — ADVANCED REASONING

#### 4.1 Temporal Reasoning

Add module:

```
projects/cic/core/reasoning/temporal.py
```

Capabilities:

- event ordering
- timeline conflict detection
- inferred chronology

#### 4.2 Entity Linking

Add module:

```
projects/cic/core/reasoning/entity_linker.py
```

Capabilities:

- cross‑document entity resolution
- alias unification
- identity confidence scoring

#### 4.3 Source Credibility Scoring

Add module:

```
projects/cic/core/reasoning/source_credibility.py
```

Capabilities:

- outlet reputation
- author reliability
- cross‑source consistency

---

### PHASE 5 — OPERATOR EXPERIENCE

#### 5.1 Operator UI Integration

Integrate with operator console:

```
operator-ui/control-room.html
```

Features:

- pipeline visualization
- evidence packet viewer
- narrative + audit viewer
- signal dashboards

#### 5.2 CLI Tooling

Add:

```
projects/cic/cli/cic-run
projects/cic/cli/cic-debug
projects/cic/cli/cic-batch
```

#### 5.3 Logging + Telemetry

Add structured logs:

```
projects/cic/logs/
```

---

### PHASE 6 — FUTURE EXPANSIONS

#### 6.1 Multi‑Topic Clustering

Automatically group related topics.

#### 6.2 Multi‑Modal Synthesis

Combine:

- text
- images
- timelines
- metadata

#### 6.3 Long‑Context Memory

Add rolling context for multi‑day investigations.

#### 6.4 Operator‑Driven Overrides

Allow manual adjustments to:

- canonical claims
- event ordering
- narrative sections

---

## 4. VERSIONING PLAN

### v3.1 — Reliability Release

- full test suite
- golden files
- caching improvements

### v3.2 — Performance Release

- async ingestion
- batch pipeline
- parallel compression

### v3.3 — Reasoning Release

- temporal reasoning
- entity linking
- credibility scoring

### v3.4 — Operator Release

- UI integration
- CLI tools
- telemetry

### v4.0 — Multi‑Modal Intelligence

- unified multi‑modal synthesis
- advanced cross‑source reasoning
- topic clustering

---

## 5. RISKS + MITIGATIONS

### Risk: Model variance

Mitigation:

- cheap‑model dominance
- JSON‑only prompts
- canonicalization before synthesis

### Risk: Source inconsistency

Mitigation:

- cross‑source signals
- contradiction resolver
- audit engine

### Risk: Scaling bottlenecks

Mitigation:

- async ingestion
- parallel compression
- caching

---

## 6. SUMMARY

CIC v3.0 is a complete, deterministic research engine.  
The roadmap defines a clear path to v4.0 with:

- reliability
- performance
- advanced reasoning
- operator experience
- multi‑modal intelligence

CIC is now ready for production‑grade evolution.

# END OF DOCUMENT
