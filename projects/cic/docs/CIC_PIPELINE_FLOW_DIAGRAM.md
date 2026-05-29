# File: projects/cic/docs/CIC_PIPELINE_FLOW_DIAGRAM.md

# Path: projects/cic/docs/CIC_PIPELINE_FLOW_DIAGRAM.md

# Purpose: High‑fidelity ASCII/SVG‑style pipeline diagram for CIC (Cast Iron Charlie)

# ============================================================

# CAST IRON CHARLIE — PIPELINE FLOW DIAGRAM (ASCII/SVG STYLE)

# ============================================================

## 1. FULL SYSTEM DIAGRAM (HIGH‑FIDELITY ASCII)

```
                                      ┌──────────────────────────────┐
                                      │        SOURCE INPUTS         │
                                      │  URLs • Files • Images •     │
                                      │  PDFs • Posts • Transcripts  │
                                      └───────────────┬──────────────┘
                                                      │
                                                      ▼
                                      ┌────────────────────────────────┐
                                      │            INGEST              │
                                      │  fetch_raw()                   │
                                      │  RawArtifact[]                 │
                                      └───────────────┬───────────────┘
                                                      │
                                                      ▼
                                      ┌────────────────────────────────┐
                                      │            ENRICH              │
                                      │  entity_extractor              │
                                      │  timeline_extractor            │
                                      │  location_extractor            │
                                      │  people_extractor              │
                                      │  reverse_image_search          │
                                      │  EnrichedArtifact[]            │
                                      └───────────────┬───────────────┘
                                                      │
                                                      ▼
         ┌──────────────────────────────────────────────────────────────────────────────────────────────┐
         │                                           COMPRESS                                            │
         │                                                                                               │
         │   ┌──────────────────────┬──────────────────────┬──────────────────────┬──────────────────┐   │
         │   │    DOCUMENT          │       IMAGE           │      TIMELINE        │  ENTITY CLUSTER  │   │
         │   │  compression         │   compression         │   compression        │   compression     │   │
         │   │  claims/entities     │   OCR + scene         │   normalized events  │   canonical name  │   │
         │   │  events              │   reverse-image       │                      │   aliases         │   │
         │   └──────────────────────┴──────────────────────┴──────────────────────┴──────────────────┘   │
         │                                                                                               │
         │   CROSS-SOURCE CANONICALIZATION                                                               │
         │   - canonical_claims                                                                          │
         │   - canonical_entities                                                                        │
         │   - canonical_events                                                                          │
         │   - signals: agreement_density • contradiction_density • coverage                             │
         │                                                                                               │
         │   Output: EvidencePacket                                                                      │
         └───────────────┬──────────────────────────────────────────────────────────────────────────────┘
                         │
                         ▼
         ┌──────────────────────────────────────────────────────────────────────────────────────────────┐
         │                                         ORCHESTRATE                                           │
         │   decision_graph():                                                                            │
         │     - run_synthesis?                                                                           │
         │     - run_audit?                                                                               │
         │     - evaluate signals                                                                          │
         └───────────────┬──────────────────────────────────────────────────────────────────────────────┘
                         │
                         ▼
         ┌──────────────────────────────────────────────────────────────────────────────────────────────┐
         │                                           SYNTHESIZE                                          │
         │   narrative_builder()                                                                         │
         │   contradiction_resolver()                                                                    │
         │   summary_generator()                                                                         │
         │   Output: narrative • contradictions • summary                                                │
         └───────────────┬──────────────────────────────────────────────────────────────────────────────┘
                         │
                         ▼
         ┌──────────────────────────────────────────────────────────────────────────────────────────────┐
         │                                              AUDIT                                            │
         │   audit_rules()                                                                              │
         │   audit_review()                                                                             │
         │   audit_trace()                                                                              │
         │   Output: audit_trace • contradictions • scores                                              │
         └──────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. MINIMAL “OPERATOR VIEW” DIAGRAM

```
sources
  ↓
INGEST
  ↓
ENRICH
  ↓
COMPRESS
  ↓
ORCHESTRATE
  ↓
SYNTHESIZE → AUDIT
```

---

## 3. SIGNAL FLOW (CROSS‑SOURCE → ORCHESTRATOR)

```
canonical_claims ┐
canonical_events ├──→ signals → decision_graph → { run_synthesis, run_audit }
canonical_entities┘
```

---

## 4. MODEL TIER FLOW

```
INGEST → none
ENRICH → none
COMPRESS → cheap models only
SYNTHESIZE → reasoning + cheap
AUDIT → deterministic + reasoning
```

---

## 5. PIPELINE CONTRACT SUMMARY

```
RawArtifact[] → EnrichedArtifact[] → EvidencePacket → Orchestration → Narrative → AuditTrace
```

---

# END OF DOCUMENT
