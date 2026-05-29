# File: projects/cic/docs/CIC_ARCHITECTURE.md

# Path: projects/cic/docs/CIC_ARCHITECTURE.md

# Purpose: Deep architecture specification for the Cast Iron Charlie Documentary Research Engine (CIC)

# ============================================================

# CAST IRON CHARLIE — ARCHITECTURE SPECIFICATION

# ============================================================

## 1. ARCHITECTURAL PHILOSOPHY

CIC is built on three core principles:

1. **Deterministic Pipelines**  
   Every stage produces typed, reproducible outputs. No hidden state. No implicit behavior.

2. **Compression‑First Reasoning**  
   CIC never reasons over raw data. All reasoning happens on compressed, canonicalized evidence.

3. **Model‑Agnostic Execution**  
   CIC can swap model providers without changing pipeline logic.

The architecture is modular, layered, and strictly typed.

---

## 2. TOP‑LEVEL ARCHITECTURE

```
projects/cic/
  core/          # core logic (ingest, enrich, compress, orchestrate, synthesize, audit)
  agents/        # agent wrappers for pipeline stages
  pipelines/     # orchestrated flows
  docs/          # system documentation
  tests/         # unit + integration tests
```

Each module is isolated and communicates only through typed artifacts.

---

## 3. CORE MODULES

### 3.1 INGEST MODULE

**Purpose:** Convert external sources into `RawArtifact` objects.

Components:

- `fetcher.py`
- `extractor_text.py`
- `extractor_image.py`
- `extractor_pdf.py`
- `extractor_audio.py`
- `schemas/raw_artifact.py`

Responsibilities:

- Fetch content  
- Detect type  
- Extract minimal metadata  
- Normalize into a unified schema  

Output: `RawArtifact[]`

---

### 3.2 ENRICH MODULE

**Purpose:** Add semantic metadata to raw artifacts.

Components:

- `entity_extractor.py`
- `timeline_extractor.py`
- `location_extractor.py`
- `people_extractor.py`
- `reverse_image_search.py`
- `schemas/enriched_artifact.py`

Responsibilities:

- Named entity extraction  
- Timeline extraction  
- Location extraction  
- People detection  
- Reverse image search  

Output: `EnrichedArtifact[]`

---

### 3.3 COMPRESSION MODULE

**Purpose:** Convert enriched artifacts into structured evidence.

Submodules:

- `document/`
- `image/`
- `timeline/`
- `entity_cluster/`
- `cross_source/`

Responsibilities:

- Reduce enriched artifacts to structured JSON  
- Extract claims, entities, events  
- Normalize timelines  
- Canonicalize entities  
- Merge cross‑source evidence  
- Compute signals (agreement, contradiction, coverage)

Output: `EvidencePacket`

---

### 3.4 ORCHESTRATION MODULE

**Purpose:** Decide which agents fire next.

Components:

- `decision_graph.py`
- `router.py`
- `agent_contracts.py`
- `evidence_packet.py`

Responsibilities:

- Evaluate cross‑source signals  
- Determine whether synthesis should run  
- Determine whether audit should run  
- Route evidence to appropriate agents  

Output:

```
{
  run_synthesis: bool,
  run_audit: bool,
  signals: {...}
}
```

---

### 3.5 SYNTHESIS MODULE

**Purpose:** Build narrative from canonical evidence.

Components:

- `narrative_builder.py`
- `contradiction_resolver.py`
- `summary_generator.py`

Responsibilities:

- Construct narrative from canonical claims + events  
- Detect contradictions  
- Generate summary  

Output:

```
{
  narrative: {...},
  contradictions: {...},
  summary: "..."
}
```

---

### 3.6 AUDIT MODULE

**Purpose:** Validate narrative against canonical evidence.

Components:

- `audit_rules.py`
- `audit_trace.py`
- `audit_log.py`
- `prompts/audit_review.json`

Responsibilities:

- Deterministic claim alignment  
- Model‑based contradiction review  
- Audit scoring  
- Produce audit trace  

Output:

```
{
  audit_trace: AuditTrace,
  contradictions: [...],
  scores: {...}
}
```

---

## 4. MODEL ROUTER

**Location:** `projects/cic/core/models/`

Tiers:

- **cheap** → compression  
- **reasoning** → synthesis + audit  
- **premium** → fallback only  

Providers:

- Gemini  
- Claude  
- Copilot  
- Local Llama  

Router guarantees:

- JSON‑only  
- deterministic fallbacks  
- no hallucinated schema fields  

---

## 5. AGENT LAYER

**Location:** `projects/cic/agents/`

Agents wrap pipeline stages:

```
ingestion_agent
enrichment_agent
compression_agent
orchestrator_agent
synthesis_agent
audit_agent
```

Agents are stateless, typed, and deterministic.

---

## 6. PIPELINE LAYER

**Location:** `projects/cic/pipelines/`

Pipelines orchestrate multi‑stage flows:

```
pipeline_ingest
pipeline_enrich
pipeline_compress
pipeline_full
```

`pipeline_full` runs the entire CIC system end‑to‑end.

---

## 7. DATA CONTRACTS

### RawArtifact

- raw text / bytes  
- type  
- metadata  

### EnrichedArtifact

- entities  
- timeline  
- locations  
- people  
- reverse image results  

### EvidencePacket

- compressed documents  
- compressed images  
- compressed timelines  
- compressed entity clusters  
- cross‑source canonicalization  

### Orchestration Output

- synthesis decision  
- audit decision  
- signals  

### Synthesis Output

- narrative  
- contradictions  
- summary  

### Audit Output

- audit_trace  
- contradictions  
- scores  

---

## 8. EXECUTION ORDER

```
1. ingestion_agent
2. enrichment_agent
3. compression_agent
4. orchestrator_agent
5. synthesis_agent (conditional)
6. audit_agent (conditional)
```

No stage may skip or reorder these steps.

---

## 9. ERROR MODEL

CIC uses typed exceptions:

- `InvalidInputError`
- `MissingFieldError`
- `ModelFailureError`
- `PipelineContractError`

No generic exceptions allowed.

---

## 10. TESTING ARCHITECTURE

Tests live under:

```
projects/cic/tests/
```

Test types:

- unit tests  
- integration tests  
- golden file tests  
- pipeline regression tests  

Coverage targets:

- 90% deterministic modules  
- 70% model‑dependent modules  

---

## 11. FUTURE EXTENSIONS

- temporal reasoning  
- entity linking  
- source credibility scoring  
- multi‑topic clustering  
- operator UI integration  
- batch processing  
- async ingestion  
- parallel compression  

---

# END OF DOCUMENT
