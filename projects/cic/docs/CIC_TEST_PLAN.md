# File: projects/cic/docs/CIC_TEST_PLAN.md

# Path: projects/cic/docs/CIC_TEST_PLAN.md

# Purpose: Comprehensive test plan for the Cast Iron Charlie Documentary Research Engine (CIC)

# ============================================================

# CAST IRON CHARLIE — TEST PLAN (v3.0)

# ============================================================

## 1. OVERVIEW

This document defines the full testing strategy for CIC across:
- unit tests
- integration tests
- pipeline tests
- golden file tests
- reliability tests
- failure‑mode tests

All tests MUST be deterministic, reproducible, and model‑agnostic.

Test root directory:

```
projects/cic/tests/
```

---

## 2. TEST COVERAGE TARGETS

| Module Type            | Coverage Target |
|------------------------|-----------------|
| Deterministic modules  | **90%+**        |
| Model‑dependent code   | **70%+** (mocked) |
| Pipelines              | **100% path coverage** |

---

## 3. TEST STRUCTURE

```
projects/cic/tests/
  core/
    ingest/
    enrich/
    compression/
    orchestrate/
    synthesize/
    audit/
    models/
  agents/
  pipelines/
  golden/
```

---

## 4. UNIT TESTS

### 4.1 INGEST MODULE

Test files:
```
projects/cic/tests/core/ingest/test_fetcher.py
projects/cic/tests/core/ingest/test_raw_artifact.py
```

Test cases:
- URL fetch success
- file path fetch success
- unsupported type detection
- metadata extraction
- error handling (404, missing file)

---

### 4.2 ENRICH MODULE

Test files:
```
projects/cic/tests/core/enrich/test_entity_extractor.py
projects/cic/tests/core/enrich/test_timeline_extractor.py
projects/cic/tests/core/enrich/test_location_extractor.py
projects/cic/tests/core/enrich/test_people_extractor.py
projects/cic/tests/core/enrich/test_reverse_image_search.py
```

Test cases:
- entity extraction correctness
- timeline normalization
- location parsing
- people detection
- reverse image search fallback behavior

---

### 4.3 COMPRESSION MODULE

Test files:
```
projects/cic/tests/core/compression/document/
projects/cic/tests/core/compression/image/
projects/cic/tests/core/compression/timeline/
projects/cic/tests/core/compression/entity_cluster/
projects/cic/tests/core/compression/cross_source/
```

Test cases:
- prompt construction
- JSON schema validation
- fallback behavior when model returns empty JSON
- canonicalization correctness
- signal computation (agreement, contradiction, coverage)

---

### 4.4 ORCHESTRATION MODULE

Test files:
```
projects/cic/tests/core/orchestrate/test_decision_graph.py
projects/cic/tests/core/orchestrate/test_router.py
```

Test cases:
- decision graph thresholds
- synthesis vs audit routing
- signal propagation

---

### 4.5 SYNTHESIS MODULE

Test files:
```
projects/cic/tests/core/synthesize/test_narrative_builder.py
projects/cic/tests/core/synthesize/test_contradiction_resolver.py
projects/cic/tests/core/synthesize/test_summary_generator.py
```

Test cases:
- narrative structure validation
- contradiction detection
- summary length + density
- model fallback behavior (mocked)

---

### 4.6 AUDIT MODULE

Test files:
```
projects/cic/tests/core/audit/test_audit_rules.py
projects/cic/tests/core/audit/test_audit_log.py
```

Test cases:
- deterministic claim alignment
- audit scoring
- contradiction merging
- audit trace construction

---

### 4.7 MODEL ROUTER

Test files:
```
projects/cic/tests/core/models/test_router.py
```

Test cases:
- cheap → reasoning → premium fallback chain
- JSON validation
- error handling

---

## 5. AGENT TESTS

Test files:
```
projects/cic/tests/agents/test_ingestion_agent.py
projects/cic/tests/agents/test_enrichment_agent.py
projects/cic/tests/agents/test_compression_agent.py
projects/cic/tests/agents/test_orchestrator_agent.py
projects/cic/tests/agents/test_synthesis_agent.py
projects/cic/tests/agents/test_audit_agent.py
```

Test cases:
- correct pipeline calls
- correct output types
- no mutation of upstream artifacts
- error propagation

---

## 6. PIPELINE TESTS

### 6.1 INGEST PIPELINE

```
projects/cic/tests/pipelines/test_pipeline_ingest.py
```

Cases:
- multiple sources
- mixed types
- error handling

---

### 6.2 ENRICH PIPELINE

```
projects/cic/tests/pipelines/test_pipeline_enrich.py
```

Cases:
- entity/timeline/location/people enrichment
- reverse image search branching

---

### 6.3 COMPRESSION PIPELINE

```
projects/cic/tests/pipelines/test_pipeline_compress.py
```

Cases:
- document/image/timeline/entity cluster compression
- cross‑source canonicalization
- signal generation

---

### 6.4 FULL PIPELINE

```
projects/cic/tests/pipelines/test_pipeline_full.py
```

Cases:
- end‑to‑end run
- synthesis conditional execution
- audit conditional execution
- output contract validation

---

## 7. GOLDEN FILE TESTS

Location:
```
projects/cic/tests/golden/
```

Purpose:
- ensure regression stability
- detect unintended changes in compression or synthesis

Golden files include:
- canonical claims
- canonical events
- narrative outputs
- audit traces

Tests MUST:
- compare output to golden JSON
- allow explicit regeneration via CLI flag

---

## 8. FAILURE‑MODE TESTS

Test scenarios:
- missing fields
- malformed JSON from model
- empty model responses
- corrupted artifacts
- unsupported file types
- network failures
- model timeouts (mocked)

Expected behavior:
- typed exceptions
- no silent failures
- no partial artifacts

---

## 9. PERFORMANCE TESTS

Targets:
- ingestion throughput
- enrichment latency
- compression batch performance
- cross‑source canonicalization speed

Performance tests MUST NOT:
- depend on external models
- depend on network

---

## 10. RELIABILITY TESTS

Scenarios:
- repeated runs produce identical outputs
- model fallback paths behave deterministically
- pipeline ordering is preserved
- no cross‑stage mutation

---

## 11. CI/CD REQUIREMENTS

CI MUST:
- run full test suite
- enforce coverage thresholds
- block merges on failures
- support golden file diffing

---

## 12. SUMMARY

This test plan ensures CIC is:
- deterministic  
- reliable  
- regression‑safe  
- model‑agnostic  
- production‑ready  

CIC v3.0 requires strict adherence to this plan for all future development.

# END OF DOCUMENT
