# File: projects/cic/docs/CIC_SYSTEM.md
# Path: projects/cic/docs/CIC_SYSTEM.md
# Version: 3.1.0
# Date: 2026-05-28
# Purpose: Master system specification for the Cast Iron Charlie Documentary Research Engine (CIC)

# ============================================================
# CAST IRON CHARLIE — DOCUMENTARY RESEARCH ENGINE (CIC)
# SYSTEM SPECIFICATION (v3.1.0)
# ============================================================

## 1. SYSTEM OVERVIEW

CIC is a deterministic, multi-agent research engine designed to bridge the gap between documentary narrative development and autonomous technical execution. It follows a strict pipeline:

```
INGEST → ENRICH → COMPRESS → ORCHESTRATE → SYNTHESIZE → AUDIT
```

The system is now **Goal-Driven**, where narrative gaps identified by the film team are materialized as autonomous research goals via the `/goal` DSL.

---

## 2. CORE PRINCIPLES (OPERATOR-GRADE)

1. **Deterministic Execution**: Every stage produces typed, stable, and verifiable outputs.
2. **Goal-Oriented**: The system executes against declarative `/goal` contracts (DSL v0.9.2+).
3. **Governance-First**: Real-time enforcement of cost (Economy), safety (Security), and truth (Audit) constraints.
4. **Narrative-Technical Bridge**: Direct data flow from the Narrative Gap Register to Ingestion Harvesters.
5. **Environment Awareness**: Host-level health (WSL2/Linux) is a first-class citizen in the execution loop.

---

## 3. INGEST MODULE (GOAL-MATERIALIZED)

**Purpose:** Fetch raw artifacts based on materialized goals or manual triggers.

**New in v3.1.0:**
- **Narrative Gap Register Fetcher**: Ingests story "holes" (time/location/theme) from Phase 2 of the Roadmap.
- **Harvester v2**: Goal-driven autonomous ingestion of web/archival sources.

**Output type:** `RawArtifact`

---

## 4. ENRICH MODULE (RIGHTS-AWARE)

**Purpose:** Add semantic metadata and legal context to raw artifacts.

**New in v3.1.0:**
- **Rights Metadata Extractor**: Captures license type, term, territory, and usage class per asset.
- **Enrichment Chain**: Sequential execution of Entity, Timeline, and Reverse Image Search.

**Output type:** `EnrichedArtifact` (includes `rights_context`)

---

## 5. ORCHESTRATION MODULE (DSL-DRIVEN)

**Purpose:** Parse `/goal` contracts and execute the multi-agent decision graph.

**Components:**
- **DSL Parser**: Validates and enforces constraints from `CIC_GOAL_DSL.md`.
- **MAS Router**: Dynamically routes tasks to agents based on `model_tier` and `security_level`.
- **Retry/Rollback Logic**: Deterministic failure handling as defined in the goal.

**Input:** `/goal` block or `EvidencePacket`.

---

## 6. GOVERNANCE SUBSYSTEM (OPERATOR-LEVEL)

**Purpose:** Enforce system integrity, economic efficiency, and host health.

**Core Agents:**
- **TokenEconomyAgent**: Enforces `max_cost` and `token_budget`. Optimizes model routing for ROI.
- **SecuritySentinelAgent**: Enforces `security_level`. Quarantines PII or malicious payloads.
- **AuditAgent**: Enforces `audit.confidence`. Validates synthesis against canonical evidence.

**Environment Health Plane (C1-C4):**
- Real-time monitoring of WSL2/Linux host (CPU, Disk, Memory).
- Automated safeguard triggers for disk pressure or CPU saturation.

---

## 7. OUTPUT CONTRACT (v3.1.0)

Final pipeline output structure:

```json
{
  "goal_id": "string",
  "status": "success | failed | rolled_back",
  "metrics": {
    "cost": "USD",
    "tokens": "number",
    "host_health": "object"
  },
  "narrative": {
    "content": "string",
    "audit_confidence": "float (0-1)",
    "rights_status": "clean | restricted | unknown"
  },
  "evidence": "EvidencePacket",
  "audit_trace": "AuditTrace"
}
```

---

## 8. REVISION POLICY
- This document is a **Living Spec**.
- Changes to the `/goal` DSL must be reflected here immediately.
- Version increments follow the Roadmap (v2.5.1) and DSL (v0.9.2) alignment.

# END OF SPEC
