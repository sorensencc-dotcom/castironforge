# File: projects/cic/docs/CIC_PIPELINE_FLOW.md
# Path: projects/cic/docs/CIC_PIPELINE_FLOW.md
# Version: 3.1.0
# Date: 2026-05-28
# Purpose: End‑to‑end CIC pipeline flow specification with Goal-Driven integration

# ============================================================
# CAST IRON CHARLIE — PIPELINE FLOW SPECIFICATION (v3.1.0)
# ============================================================

## 1. HIGH-LEVEL GOAL-DRIVEN FLOW

CIC v3.1.0 operates as a **Goal-Driven** engine. The pipeline is triggered by `/goal` contracts which define the intent, constraints, and success criteria.

```
GOAL (DSL) → INGEST → ENRICH → COMPRESS → ORCHESTRATE → SYNTHESIZE → AUDIT → GOVERNANCE
```

---

## 2. ASCII PIPELINE DIAGRAM (OPERATOR-GRADE)

```
 ┌──────────────────────┐
 │   NARRATIVE GAPS     │
 │ (Gap Register Phase 2)│
 └──────────┬───────────┘
            │
            ▼
 ┌──────────────────────┐
 │   /goal MATERIALIZE  │
 │ (DSL v0.9.2-alpha)   │
 └──────────┬───────────┘
            │
            ▼
 ┌──────────────────────┐   ┌──────────────────────┐
 │      INGEST          │   │  TokenEconomyAgent   │
 │ Harvester v2         │◀──┤ (Cost/Token Control) │
 │ RawArtifact[]        │   └──────────────────────┘
 └──────────┬───────────┘
            │
            ▼
 ┌──────────────────────┐   ┌──────────────────────┐
 │      ENRICH          │   │ SecuritySentinelAgent│
 │ Rights Metadata      │◀──┤ (PII/Policy Guard)   │
 │ EnrichedArtifact[]   │   └──────────────────────┘
 └──────────┬───────────┘
            │
            ▼
 ┌──────────────────────────────────────────────┐
 │                 COMPRESS                     │
 │  (EvidencePacket Creation)                   │
 └──────────┬────────────────────────────────────┘
            │
            ▼
 ┌──────────────────────┐
 │    ORCHESTRATOR      │
 │  (MAS Router v1.2)   │
 └──────────┬───────────┘
            │
            ▼
 ┌──────────────────────┐   ┌──────────────────────┐
 │     SYNTHESIZE       │   │      AuditAgent      │
 │ (Narrative Blocks)   │──▶│ (Confidence/Truth)   │
 └──────────┬───────────┘   └──────────┬───────────┘
            │                          │
            └────────────┬─────────────┘
                         │
                         ▼
 ┌──────────────────────────────────────────────┐
 │             GOAL FINALIZATION                │
 │ Status: success | failed | rolled_back       │
 │ Metrics: cost / host_health / rights         │
 └──────────────────────────────────────────────┘
```

---

## 3. STAGE-BY-STAGE FLOW (v3.1.0 UPDATES)

### 3.1 GOAL MATERIALIZATION
**Input:** Narrative Gap ID or Manual DSL input.
**Process:** Architect parses `CIC_GOAL_DSL.md` and initializes the execution context.

### 3.2 INGEST (GOAL-DRIVEN)
**Governance:** `TokenEconomyAgent` enforces `max_cost`.
**Responsibilities:** Harvester v2 autonomously fetches sources required to satisfy the goal.

### 3.3 ENRICH (RIGHTS-AWARE)
**Governance:** `SecuritySentinelAgent` scans for malicious payloads or PII leakage.
**Responsibilities:** Captures `rights_context` (license, usage class) alongside semantic metadata.

### 3.4 ORCHESTRATE (MAS ROUTING)
**Logic:** Routes tasks to models based on `model_tier` (economy/pro) and `security_level`.

### 3.5 AUDIT (TRUTH ENFORCEMENT)
**Responsibilities:** `AuditAgent` validates synthesis against the `EvidencePacket`. If `audit.confidence < threshold`, the goal is marked as failed or rolled back.

---

## 4. ENVIRONMENT HEALTH INTEGRATION
At every stage, the **Environment Health Plane** monitors the WSL2/Linux host:
- **Disk Pressure**: Halts ingestion if storage < 5GB.
- **CPU Saturation**: Throttles parallel extractors if load > 85%.

---

# END OF DOCUMENT
