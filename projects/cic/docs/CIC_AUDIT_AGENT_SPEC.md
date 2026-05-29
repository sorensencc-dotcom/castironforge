# File: projects/cic/docs/CIC_AUDIT_AGENT_SPEC.md
# Path: projects/cic/docs/CIC_AUDIT_AGENT_SPEC.md
# Version: 1.0.0
# Date: 2026-05-28
# Purpose: Technical specification for AuditAgent scoring and decision logic

# ============================================================
# CIC AUDIT AGENT — TRUTH THRESHOLD SPECIFICATION (v1.0.0)
# ============================================================

## 1. PURPOSE
The AuditAgent enforces epistemic integrity for research outputs by scoring evidence, classifying anomalies, and deciding pass/fail against goal-level audit constraints.

## 2. SCORING MODEL

### 2.1 Per-Evidence Confidence ($c_e$)
For each EvidenceSupportRecord where `support_type` is SUPPORTS or CONTRADICTS:

$$c_e = support\_strength \times source\_weight \times temporal\_weight$$

**Weights:**
- **Primary**: 1.0 | **Secondary**: 0.7 | **Tertiary**: 0.4 | **Unknown**: 0.3
- **Aligned**: 1.0 | **Off by 1 yr**: 0.8 | **Off by 2-5 yrs**: 0.6 | **Conflicting**: 0.4

### 2.2 Hypothesis-Level Confidence ($conf_{hyp}$)
$$conf_{hyp} = \max(0, s - \alpha \cdot k)$$
- $s$: Normalized sum of supporting confidence.
- $k$: Normalized sum of contradicting confidence.
- $\alpha$: Contradiction penalty (default 1.2).

### 2.3 Goal-Level Confidence ($conf_{goal}$)
$$conf_{goal} = \min(H_{factual})$$
The weakest required factual claim sets the ceiling for the goal’s audit confidence.

---

## 3. ANOMALY TAXONOMY

| Anomaly Type | Severity | Description |
|---|---|---|
| STRUCTURAL_ANOMALY | MED/HIGH | Missing fields, malformed records, broken provenance. |
| TEMPORAL_ANOMALY | MED/HIGH | Evidence timeframe conflicts with hypothesis anchor. |
| SEMANTIC_CONFLICT | HIGH | High-confidence contradictions between sources. |
| ATTRIBUTION_ANOMALY | MED/HIGH | Misattributed quotes or mislinked entities. |
| COVERAGE_GAP | HIGH | No primary/high-quality sources for critical claims. |

---

## 4. DECISION LOGIC

1. **Rule D1 (High Anomaly)**: If `high_count > 0` → **FAIL**.
2. **Rule D2 (Anomaly Cap)**: If `audit.max_anomalies` exceeded → **FAIL**.
3. **Rule D3 (Confidence Floor)**: If $conf_{goal} < audit.confidence_{min}$ → **FAIL**.
4. **Rule D4 (Retry Eligibility)**: If only `STRUCTURAL` or `COVERAGE` anomalies and budget remains → **RETRY**.
5. **Rule D5 (Pass)**: If confidence met and anomalies within cap → **PASS**.

---

## 5. FAILURE ACTIONS
- **ROLLBACK**: Invalidate derived artifacts (summaries/narratives).
- **QUARANTINE**: Create `QuarantineRecord` with operator recommendations.
- **DLQ**: Enqueue systemic issues for source investigation.

---

## 6. DOMAIN TUNING: GAP-001 (WILLOW RUN)
- **Primary Bias**: 1.1x multiplier for 1943 internal Ford memos/reports.
- **Late Recollection Penalty**: 0.8x for anecdotal records created decades later.

# END OF SPEC
