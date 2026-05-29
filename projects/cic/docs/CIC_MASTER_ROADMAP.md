---
title: CIC Master Roadmap
version: 2.6.1
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
- **Gap-to-Goal Bridge:** Narrative Gap Register entries auto-materialize as `cic.harvester_v2.gap_fill` goals.

## Phase 2 — Narrative Development  
**Status:** In Progress
- Treatment draft + revision cycle.
- **Narrative Gap Register:** All unresolved story questions logged as machine-readable gaps (time, location, theme).
- **Deliverables:** Locked treatment, interview roster, Narrative Gap Register (CIC-ready).

## Phase 3 — Pre-Production & Rights  
**Status:** Pending
- **Rights Metadata Capture:** License type, term, territory, usage class stored per asset.
- DP selection, Budgeting, Location scouting.

## Phase 3b — Funding & Grant Milestones  
**Status:** Planned
- Grant pipeline tracking (applications, decisions, reporting).
- Funding milestone ledger (dev, production, post, outreach).
- Rewrite Labs alignment hooks (runway, ROI, partner leverage).
- **Deliverables:** Funding milestone ledger, grant obligations register.

---

# PART II — CIC Intelligence Pipeline Roadmap

## Phase 7 — Ingestion System (CIC-INGEST)  
**Status:** Active  
**New in v2.6.0**
- **Queue Layer** fully integrated (`producer.ts`, `dlq.ts`, `drift.ts`, `schemas.ts`).
- **Section Tracking System** online (§0.1‑A Qdrant client COMPLETE; next: §0.2 Folder scan).
- **ReverseImageSearchExtractor** integrated (6/6 tests passing).
- **Qdrant Vector Store** connectivity and health checks integrated.
- Harvester integration with multi-extractor routing.
- **Gap-to-Goal Bridge:** Integration with Narrative Gap Register for autonomous research goals.

## Phase 8 — Enrichment Layer  
**Status:** In Progress  
- ImageAnalyzerV2 + Extractor chaining.
- ReverseImageSearchExtractor outputs merged into enrichment bundles.

## Phase 8b — Rights Metadata Enrichment  
**Status:** Planned  
- Attach rights/usage metadata to each ingested asset.
- Expose rights flags to synthesis layer (broadcast-safe, festival-only).
- **Deliverables:** Rights-aware enrichment outputs, synthesis-safe asset catalog.

## Phase 9 — Orchestration & Governance  
**Status:** Active  
- **TokenEconomyAgent:** Cost capping & model affinity routing.
- **SecuritySentinelAgent:** Zero-Trust perimeter & integrity guarding.
- MAS-aware orchestrator v1.2.0.

## Phase 10 — Synthesis & Audit  
**Status:** Pending  
- **AuditAgent:** Confidence scoring & factual alignment gating.
- Synthesis of narrative blocks based on treatment gaps.

---

# PART III — Control Plane, Dashboard & MAS

## Phase 12 — Control Plane v2.4.0  
**Status:** Active  
- Unified operator surface with Token/Security metrics.
- **Environment Health Plane:** WSL2/Linux host monitoring (CPU, disk, memory) surfaced into SLO Dashboard.
- Integration with new ingestion dashboard (see Phase 15).

## Phase 15 — Operator Dashboard (New in v2.6.0)  
**Status:** Active  
- HTML/JS dashboard (`src/dashboard/index.html`).
- 6-agent polling (Harvester, Extractor, Analyzer, Indexer, Sweeper, Synthesis).
- Pulse states (idle, running, error, degraded).
- Pipeline diagram (ingestion → enrichment → indexing → synthesis).
- Host-level health surfaced from Control Plane v2.4.0.

## Phase 16 — Autonomous Recovery Plane  
**Status:** Active  
- SLO Metrics Plane (C1) and Recovery Policies Engine (C2).
- **Host-level safeguards:** Disk pressure and CPU saturation enforcement for ingestion workloads.

---

# PART IV — Governance & Versioning

## Living Document Policy  
- Markdown in `projects/cic/docs/` is the source of truth.
- Git is the authoritative history.

## Versioning Rules  
- **Major** = structural change  
- **Minor** = subsystem addition  
- **Patch** = corrections  

**Current:** v2.6.0 (minor) — subsystem additions (Queue Layer, Extractor #2, Dashboard, Section Tracking).
