# File: projects/cic/docs/SEARXNG_EXECUTION_PLAN_GAP-001.md
# Path: projects/cic/docs/SEARXNG_EXECUTION_PLAN_GAP-001.md
# Version: 1.0.0
# Date: 2026-05-28
# Purpose: Operator-grade execution plan for GAP-001 autonomous retrieval

# ============================================================
# ✦ SearXNG Execution Plan v1.0 (GAP-001)
# ============================================================

## 1. QUERY FAN-OUT (STRUCTURED EXPANSION)
CIC expands the core query into a deterministic set of sub-queries mapped to SearXNG categories.

### 1.1 Primary Historical Queries
- “Charles Sorensen Willow Run 1943”
- “Ford B-24 production bottlenecks 1943”
- “Willow Run management conflict 1943”
- “Ford executives wartime production 1943”
- “War Department Ford oversight 1943”

### 1.2 Secondary Context Queries
- “Willow Run factory output 1943”
- “B-24 Liberator production delays WWII”
- “Ford wartime industrial disputes”

### 1.3 Archival / Academic Queries
- “Sorensen testimony 1943 Willow Run”
- “Ford internal memos 1943 production”
- “WWII industrial mobilization Ford”

---

## 2. ENGINE ROUTING (CATEGORY MAP)

- **Academic**: Semantic Scholar, CORE, JSTOR mirrors.
- **News / Historical**: Newspapers.com mirrors, NYT archive, AP archive.
- **Business / Industry**: Automotive history archives, Bloomberg, Reuters.
- **General Web**: Wikipedia, History sites, Ford historical pages.
- **Images**: Wikimedia, Flickr Commons, WWII photo archives.

---

## 3. HARVESTER v2 — EVIDENCE ACQUISITION
Each result is normalized into an `EvidenceItem` with:
- `source_type` (PRIMARY/SECONDARY/TERTIARY)
- `reliability_score_local`
- `rights_context` (from RightsMetadata v3.1.0)
- `provenance_chain` (archive → collection → item)

---

## 4. ENRICHER — GRAPH CONSTRUCTION
- **Entity Extraction**: Charles Sorensen, Edsel Ford, Willow Run, B-24, War Production Board.
- **Hypothesis Generation**:
    - **HYP-001**: Sorensen visited Willow Run in 1943.
    - **HYP-002**: Willow Run experienced B-24 bottlenecks in 1943.
    - **HYP-003**: Ford executives disputed Sorensen’s decisions.
- **Evidence Alignment**: SUPPORTS | CONTRADICTS | NEUTRAL.

---

## 5. AUDITAGENT v1.0.0 ENFORCEMENT
Enforces truth thresholds as defined in `AuditConfig_GAP-001.json`:
- **Confidence**: ≥ 0.92
- **Anomalies**: 0 allowed.

---

## 6. PIPELINE CONTROL FLOW
- **PASS**: Proceed to Synthesis.
- **RETRY**: Exponential backoff with jitter; adjusted query weights.
- **FAIL**: Rollback derived artifacts, Quarantine evidence, DLQ emission.

# END OF PLAN
