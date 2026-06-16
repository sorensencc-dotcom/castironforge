# CIC Memory Spine — Training Pipeline

How memory-vN artifacts are built from the CIC corpus.

---

## Inputs

| Source | Type | Examples |
|---|---|---|
| CIC ADRs | Architecture Decision Records | `adr-*.md` files |
| CIC design docs | Specs, RFCs | Architecture docs, service definitions |
| CIC chat logs | Conversational Q&A | Agent interactions, operator logs |
| CIC code comments | Inline documentation | Repair engine, orchestrator source |
| CIC roadmap docs | Planning documents | `ROADMAP.md`, `ROADMAP_EXTENDED.md` |
| Synthetic Q&A | Auto-generated pairs | From section headings, summaries, code comments |

---

## Preprocessing pipeline

```
Raw corpus
    │
    ▼
Chunking (semantic segments)
    │   - Functions → one chunk each
    │   - Sections → one chunk each
    │   - ADR entries → one chunk each
    ▼
Metadata tagging
    │   { doc_id, chunk_id, type, domain, timestamp, tags }
    ▼
Feature extraction
    │   - Embeddings (dense)
    │   - Sparse features (TF-IDF, BM25)
    │   - Document graph (cross-references)
    ▼
Q&A pair generation
    │   - From headings → "What is X?"
    │   - From summaries → "How does X work?"
    │   - From code → "What does function X do?"
    ▼
Training set assembly
    │   { query, context_features, answer, provenance }
    ▼
memory-vN artifact
```

---

## Training objective

**Primary:** Conditioned generation

```
P(answer | query, domain_features, time_hint)
```

The model learns to output compact answers given a query and optional context features. It does not retrieve at inference time.

**Secondary objectives:**
- Multi-hop consistency: cross-document relationships must be captured in a single pass.
- Robustness to noisy features: simulate bad retrieval and partial metadata during training.
- Confidence calibration: model outputs a calibrated confidence score alongside the answer.

---

## Model spec

| Property | Value |
|---|---|
| Architecture | Small transformer (encoder-decoder or decoder-only) |
| Parameter count | 1–3B (or distilled variant for local node deployment) |
| Training data | CIC corpus Q&A pairs + synthetic pairs |
| Output | Answer tokens + provenance pointers + confidence logit |
| Deployment | Local (single node) or distributed (per domain) |

---

## Artifact naming

```
memory-v{N}/
  model.bin          # Model weights
  config.json        # Hyperparameters, vocab, domain heads
  provenance.json    # doc_id → chunk_id mappings used during training
  confidence.json    # Calibration curves per domain
  manifest.json      # { version, corpus_snapshot, trained_at, doc_count }
```

Example `manifest.json`:

```json
{
  "version": "memory-v3",
  "corpus_snapshot": "2026-05-10T00:00:00Z",
  "trained_at": "2026-05-11T02:15:00Z",
  "doc_count": 142,
  "domains": ["cic-core", "skills", "roadmap", "infra"]
}
```

---

## Update cadence

| Trigger | Cadence |
|---|---|
| Nightly build | Every night at 02:00 UTC |
| On-demand | After significant corpus changes (e.g., new ADR batch) |
| Post-incident | After a memory failure or degraded confidence episode |

Activation is separate from training. A new artifact is built and validated before being activated via `POST /v1/memory/admin/activate`.

---

## Rollback

If a new memory version degrades answer quality or confidence calibration:

```
POST /v1/memory/admin/rollback
{ "to_version": "memory-v2" }
```

Rollback completes in <1 second (pointer swap only; no model reload required if both versions are warm).

---

## Domain-specific heads (Phase 4+)

The memory model can be extended with domain-specific output heads sharing a common backbone:

```
Shared backbone
    ├── cic-core head
    ├── skills head
    ├── roadmap head
    └── infra head
```

Each head is trained on its domain's corpus and can be updated independently. The Memory Router selects the head based on the `domain` field in the query.
