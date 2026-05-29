# File: projects/cic/docs/CIC_DEBUG_GUIDE.md

# Path: projects/cic/docs/CIC_DEBUG_GUIDE.md

# Purpose: Debugging guide for CIC (Cast Iron Charlie)

# ============================================================

# CAST IRON CHARLIE — DEBUG GUIDE (v3.0)

# ============================================================

## 1. PURPOSE

This guide explains how to debug CIC at every stage:

- ingestion
- enrichment
- compression
- orchestration
- synthesis
- audit

It provides operator‑grade procedures for isolating failures and validating artifacts.

---

## 2. DEBUGGING PRINCIPLES

1. **Always inspect upstream artifacts first**  
2. **Never trust model output without schema validation**  
3. **Check cross‑source signals before reading narrative**  
4. **Audit trace is the final truth**  
5. **Re-run stages independently to isolate faults**

---

## 3. DEBUGGING INGEST

### Symptoms

- missing artifacts  
- wrong type detection  
- empty text/image bytes  

### Steps

1. Print each `RawArtifact`  
2. Verify:
   - `kind`
   - `source_url`
   - `content`
   - `metadata`

### Common fixes

- incorrect URL  
- unsupported file type  
- network failure  

---

## 4. DEBUGGING ENRICHMENT

### Symptoms

- missing entities  
- empty timeline  
- no reverse image results  

### Steps

1. Inspect `EnrichedArtifact` fields  
2. Validate:
   - entities list non-empty  
   - timeline events sorted  
   - locations resolved  
   - people detected  

### Common fixes

- malformed raw text  
- image too low resolution  
- extractor misconfiguration  

---

## 5. DEBUGGING COMPRESSION

### Symptoms

- empty claims  
- missing canonical events  
- weak signals  

### Steps

1. Inspect each compression output:
   - document
   - image
   - timeline
   - entity cluster  
2. Validate JSON schema  
3. Inspect cross‑source canonicalization  

### Common fixes

- model returned `{}`  
- prompt misalignment  
- missing enriched fields  

---

## 6. DEBUGGING ORCHESTRATION

### Symptoms

- synthesis not triggered  
- audit not triggered  

### Steps

1. Print `signals`  
2. Check thresholds:
   - coverage > 0.2  
   - contradiction_density > 0.05  
   - agreement_density < 0.3  

### Common fixes

- insufficient evidence  
- canonicalization failure  

---

## 7. DEBUGGING SYNTHESIS

### Symptoms

- narrative missing sections  
- contradictions empty  
- summary too short  

### Steps

1. Inspect canonical claims  
2. Compare narrative to claims  
3. Validate JSON structure  

### Common fixes

- model fallback triggered  
- malformed canonical claims  

---

## 8. DEBUGGING AUDIT

### Symptoms

- alignment score too low  
- contradictions inconsistent  
- audit_trace missing fields  

### Steps

1. Inspect `alignment_results`  
2. Inspect `contradictions`  
3. Validate `AuditTrace` dataclass  

### Common fixes

- narrative missing claims  
- canonical claims incomplete  

---

## 9. DEBUGGING FULL PIPELINE

### Steps

1. Run each stage independently  
2. Compare outputs to golden files  
3. Validate schemas  
4. Inspect signals  
5. Inspect narrative  
6. Inspect audit trace  

---

## 10. SUMMARY

CIC debugging is deterministic:

- inspect upstream  
- validate schemas  
- check signals  
- verify narrative  
- confirm audit trace  

# END OF DOCUMENT
