---
title: CIC Master Roadmap
version: 2.5.1
date: 2026-05-28
---

# CIC Master Roadmap  
**Unified Production + Intelligence Pipeline Roadmap**  
Covers the feature documentary *Cast Iron Charlie* and the full CIC Intelligence System.

---

# PART I — Documentary Production Roadmap

## Phase 1 — Archival Research  
**Status:** Active (Archival Log Verification)
- Kroll Archive manual archival ingestion and classification complete; CIC automated ingestion pipeline integration tracked under Phase 7.
- Benson Ford / NASM / Burton / UT Dallas / AFHRA / LoC research.
- **Gap-to-Goal Bridge**: Narrative Gap Register entries auto-materialize as `cic.harvester_v2.gap_fill` goals.

## Phase 2 — Narrative Development  
**Status:** In Progress
- Treatment draft + revision cycle.
- **Narrative Gap Register**: All unresolved story questions logged as machine-readable gaps (time, location, theme).
- **Deliverables**: Locked treatment, interview roster, Narrative Gap Register (CIC-ready).

## Phase 3 — Pre-Production & Rights  
**Status:** Pending
- **Rights Metadata Capture**: License type, term, territory, usage class stored per asset.
- DP selection, Budgeting, Location scouting.

## Phase 3b — Funding & Grant Milestones
**Status:** Planned
- Grant pipeline tracking (applications, decisions, reporting).
- Funding milestone ledger (dev, production, post, outreach).
- Rewrite Labs alignment hooks (runway, ROI, partner leverage).
- **Deliverables**: Funding milestone ledger, grant obligations register.

---

# PART II — CIC Intelligence Pipeline Roadmap

## Phase 7 — Ingestion System (CIC-INGEST)  
**Status:** Active
- Harvester integration + `ReverseImageSearchExtractor` (v2 focus).
- **Gap-to-Goal Bridge**: Integration with Narrative Gap Register for autonomous research goals.

## Phase 8 — Enrichment Layer  
**Status:** In Progress
- ImageAnalyzerV2 + Extractor chaining.

## Phase 8b — Rights Metadata Enrichment
**Status:** Planned
- Attach rights/usage metadata to each ingested asset.
- Expose rights flags to synthesis layer (broadcast-safe, festival-only).
- **Deliverables**: Rights-aware enrichment outputs, synthesis-safe asset catalog.

## Phase 9 — Orchestration & Governance  
**Status:** Active
- **TokenEconomyAgent**: Cost capping & Model affinity routing.
- **SecuritySentinelAgent**: Zero-Trust perimeter & Integrity guarding.
- MAS-aware orchestrator v1.2.0.

## Phase 10 — Synthesis & Audit  
**Status:** Pending
- **AuditAgent**: Confidence scoring & factual alignment gating.
- Synthesis of narrative blocks based on treatment gaps.

---

# PART III — Control Plane & MAS

## Phase 12 — Control Plane v2.4.0  
**Status:** Active
- Unified operator surface with Token/Security metrics.
- **Environment Health Plane**: WSL2/Linux host monitoring (CPU, disk, memory) surfaced into SLO Dashboard.

## Phase 16 — Autonomous Recovery Plane  
**Status:** Active
- SLO Metrics Plane (C1) and Recovery Policies Engine (C2).
- **Host-level safeguards**: Disk pressure and CPU saturation enforcement for ingestion workloads.

---

# PART IV — Governance & Versioning

## Living Document Policy  
- Markdown in `projects/cic/docs/` is the source of truth.
- Git is the authoritative history.

## Versioning Rules  
- Major = structural change
- Minor = subsystem addition
- Patch = corrections
