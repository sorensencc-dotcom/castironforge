# CIC_SYSTEM.md — CIC Research Engine  
# v1.3.1 | 2026-05-30 | ACTIVE  
# No volatile state here — update CIC_PROJECT_STATE.md.

---

## 1. Project Identity

- **Subject:** Charles Emil Sorensen (1881–1968) — Ford exec  
- **Producer:** Chris Sorensen via Cast Iron Productions LLC  
- **Deliverable:** Documentary + research engine  
- **Claude roles:** CIC-RESEARCH (archival) | CIC-SYSTEM (pipeline)

---

## 2. Document Hierarchy

| Doc Type | File | Location | Purpose |
|---|---|---|---|
| SYSTEM | `CIC_SYSTEM.md` | `projects/cic/docs/` | Stable architecture |
| STATE | `CIC_PROJECT_STATE.md` | `projects/cic/docs/` | Volatile status |
| ROUTING | `CIC_ROUTING_SPEC_v2.3.md` | `docs/` | v2.3 Routing Spec |
| Living doc | `Treatment.md` | `projects/cic/docs/living-docs/` | Authoritative treatment |
| Living doc | `Kroll_Archive_Log.md` | `projects/cic/docs/living-docs/` | Ingestion log |
| Living doc | `Research_Logs.md` | `projects/cic/docs/living-docs/` | Research logs |
| Living doc | `QuestionsForDad.md` | `projects/cic/docs/living-docs/` | Interview bank |

**Rule:** Research → living docs. Status → STATE. Architecture → this file.

---

## 3. Codebase Locations

### Root  
`/mnt/c/Users/soren/`

### CIC Core (Python)  
`/mnt/c/Users/soren/projects/cic/`  
- Agents, pipelines

### CIC Ingestion (JS/ESM)  
`/mnt/c/Users/soren/`  
- `src/`: Ingestion logic, CLI entrypoint  
- `scripts/`: Execution  
- `config/`: Paths/sources  

---

## 4. Module Map

```text
src/
  audit/            — anomalyDetector, auditAgent, auditStore
  cli.mjs           — Central CLI entrypoint
  corpus/           — corpus-builder
  db/               — migrate, queries (SQLite, better-sqlite3, WAL)
  extractor/        — iExtractor, extractorRegistry, ImageAnalyzerV2.js, ReverseImageSearchExtractor.js
  harvester/        — harvester, extractor
  indexer/          — indexer, bundle-builder
  ingestion/        — ingestionAgent, ingestionSchema, ingestionServer, worker (authoritative ingestion worker)
  lib/              — classifier, folder-validator, logger, paths, sidecar, status
  prompts/          — loader, index, guard
  providers/        — searxng-cic.ts, qdrant.js (vector-store client, service pending)
  queue/            — producer, dlq, drift, schemas
  sweeper/          — daily-sweeper
  skillopt/         — redesignAgent, skillOptConsumer, skillRegistryLoader, telemetry, validator, metricsAggregator (SkillOpt subsystem)
  synthesis/        — briefBuilder, briefStore, synthesisAgent
  dashboard/        — operator dashboard (index.html, assets)
```

---

## 5. SkillOpt System

The SkillOpt system introduces a self-improving loop for CIC's redesign capabilities, enabling dynamic skill optimization, telemetry, and training data generation. It acts as the authoritative "synthesis" stage, generating redesign outputs and feeding back into the optimization pipeline.

### 5.1 Components (`src/skillopt/`)
-   `redesignAgent.mjs`: Core logic for generating redesign plans based on loaded skills.
-   `skillRegistryLoader.mjs`: Manages the loading and registration of different skill versions.
-   `validator.mjs`: Provides functionality for validating skill outputs against predefined criteria.
-   `telemetry.mjs`: Records performance and quality metrics of the redesign process for analysis and feedback.
-   `skillOptConsumer.mjs`: Consumes redesign outputs and relevant context to generate training data for skill optimization.
-   `metricsAggregator.mjs`: Aggregates telemetry, state, and dataset metrics for dashboard display and drift detection.

---

## 6. Routing Intelligence (v2.3)

CIC v2.3 implements a **Local-First, Cloud-Only for Reasoning** routing strategy. This maximizes token economy while maintaining high-quality synthesis.

### 6.1 Routing Policy
- **L0/L1 (Local)**: Classification, extraction, formatting, and safety pre-filtering.
- **C1 (Cloud-Flash)**: Fast extraction, outreach, and fallback reasoning.
- **C2 (Cloud-Pro)**: High-entropy reasoning (Redesign), arbitration, and long-context synthesis.

### 6.2 Fallback & Arbitration
- **Fallback**: Automatic downgrade (C2 -> C1 -> L1) triggered by `TokenEconomyAgent` telemetry (latency, cost, drift).
- **Arbitration**: C2-based resolution of multi-agent disagreements.

Reference: `docs/CIC_ROUTING_SPEC_v2.3.md` for full implementation details.

---

## 7. Prompt Management System (PMS)

### 7.1 Architecture (`src/prompts/`, `prompts/`)

Centralized registry and deterministic loader for LLM instructions.

- **Registry:** `prompts/prompts.json` maps logical names to `.prompt` files.  
- **Guard:** `src/prompts/guard.js` prevents instruction injection/drift.  
- **Index:** `src/prompts/index.js` provides secure, type-safe access.  
- **Build/Test:** `scripts/build-prompts.js` and `tests/prompt-drift.test.js`.  

---

## 8. Extractor Architecture

### 8.1 Pattern: IExtractor (`src/extractor/`)

Interface:

- `meta`: `{ id, version, accepts[] }`  
- `extract(job)`  
- `healthCheck()`  

All extractors must:

- Declare a unique `id` and semantic `version`.  
- Declare accepted MIME types / logical job types in `accepts[]`.  
- Be registered via `extractorRegistry`.  

### 8.2 ImageAnalyzerV2 (`image_analyzer_v2`, v2.0.0)

Sub-extractors (parallel):

1. `extractSceneGraph`: objects, layout, era  
2. `extractFaceClusters`: detection, clusters  
3. `extractPlaceRecognition`: landmarks, architecture  
4. `extractCrossReferences`: figures, evidence  

Requires: `GEMINI_API_KEY`.  
Wired to `scripts/run-enricher.js`.  

Extractors may emit vector payloads for Qdrant storage.
Indexer integrates with Qdrant via `providers/qdrant.js`.

### 8.3 ReverseImageSearchExtractor (v1.0.0)

- **Purpose:** Reverse-image lookup and cross-archive matching for ingested stills.  
- **Inputs:** Image buffer + file metadata from Harvester.  
- **Outputs:** Candidate matches (source URL or archive ID), similarity score, provenance hints.  
- **Integration:**  
  - Registered in `extractorRegistry`.  
  - Invoked by Harvester when `accepts[]` matches image MIME types.  
  - Results stored alongside ImageAnalyzerV2 outputs in enrichment pipeline.  
- **Status:** Fully tested (6/6 tests passing) and wired into Phase 7 ingestion work.

---

## 9. DB Schema

File: `cic_test_root/cic.db` (absolute path in `config/paths.json`)  

Tables:

- `runs`  
- `files`  
- `entities`  
- `topics`  
- `bundles`  
- `bundle_files`  
- `corpus_entries`  

`runs` table includes `files_indexed`.

---

## 10. Ingestion System (CIC-INGEST)

### 10.1 High-Level Flow

1. **Harvester** scans configured folders and sources.  
2. **Classifier** (in `lib/`) determines file type and routing.  
3. **Queue Layer** materializes ingestion jobs (see §11).  
4. **Extractor(s)** run (ImageAnalyzerV2, ReverseImageSearchExtractor, others via `extractorRegistry`).  
5. **Indexer** writes to SQLite (`db/`) and corpus.  
6. **Sweeper** performs daily cleanup and consistency checks.  

This corresponds to **Phase 7 — Ingestion System (CIC-INGEST)** in the roadmap, which is marked **Active** and explicitly calls out Harvester integration and `ReverseImageSearchExtractor` as v2 focus.   

---

## 11. Queue Layer (JS/ESM)

The queue layer is the backbone of deterministic ingestion and drift handling.

### 11.1 Components

- `src/queue/producer.ts`  
  - Creates ingestion jobs from folder scans and section tracking.  
  - Ensures all jobs conform to Zod schemas in `schemas.ts`.  

- `src/queue/dlq.ts`  
  - Dead-letter queue for failed jobs.  
  - Append-only; operators can inspect and replay.  

- `src/queue/drift.ts`  
  - Detects divergence between filesystem state and recorded ingestion state.  
  - Auto-materializes “drift jobs” to reconcile.  

- `src/queue/schemas.ts`  
  - Zod schemas for all job types (ingestion, enrichment, drift, audit).  

### 11.2 Invariants

- All jobs must validate against `schemas.ts` before enqueue.  
- Drift jobs are idempotent and safe to replay.  
- DLQ entries are never silently dropped; operator action is required.  

---

## 12. Section Tracking (Ingestion Runtime)

Section tracking makes ingestion **resumable, observable, and deterministic**.

### 12.1 Purpose

- Track progress through well-defined ingestion “sections” so that runs can be resumed without ambiguity.  
- Provide a stable contract between Harvester, Queue, and Extractors.  

### 12.2 Sections (example)

- §0.1‑A: Qdrant client wiring and connectivity.  
- §0.2: Folder scan and classification.  
- §0.3: Job planning (what to ingest).  
- §0.4: Job materialization into the queue (completed).  

### 12.3 State Storage

- Stored in a small JSON state file (e.g., `cic-ingest/section_state.json`).  
- Monotonic: sections only advance; regression requires explicit operator override.  

---

## 13. npm Scripts

| Script | Command | Purpose |
|---|---|---|
| `npm run harvester` | `node scripts/run-harvester.js` | Run data ingestion |
| `npm run pipeline` | `node scripts/run-pipeline.js` | Run full ingestion pipeline |
| `npm run image:analyze` | `node scripts/run-audit.js` | Run audit/analysis on images |
| `npm run image:reverse` | `node scripts/run-enricher.js` | Run enrichment on images |
| `npm run run-mcp` | `node scripts/run-mcp.js` | Start MCP server |
| `npm run run-scanner` | `node scripts/run-scanner.js` | Start perimeter scanner |
| `npm run skillopt:validate` | `node src/cli.mjs skillopt:validate <itemPath> <outputPath>` | Validate a SkillOpt item |
| `npm run skillopt:train` | `node src/cli.mjs skillopt:train` | Train SkillOpt models |
| `npm run skillopt:deploy` | `node src/cli.mjs skillopt:deploy` | Deploy SkillOpt model |
| `npm run skills:sync` | `node scripts/skills-sync.js` | Automated skills discovery |
| `npm run success:docs` | `node scripts/living-docs-sync.js` | Sync Living Docs |
| `npm run success:full` | `npm run success && npm run success:docs` | Full protocol + Doc sync |
| `npm run skillopt:dashboard` | `node src/dashboard/server.mjs` | Start SkillOpt Dashboard server |
| `npm run skillopt:check` | `node scripts/skillopt-check.mjs` | Run SkillOpt drift & alerts check |

---

## 14. Operator Dashboard


### 14.1 Location

- `src/dashboard/index.html` (plus any supporting JS/CSS assets).

### 14.2 Features

- **6-agent polling view**: Harvester, Extractor, Analyzer, Indexer, Sweeper, Synthesis.  
- **SkillOpt Telemetry Integration**: Displays live skill version timelines, validation score charts, redesign diffs, drift detection, and latency graphs.
- **Pulse states**: idle, running, error, degraded.  
- **Pipeline diagram**: visual representation of ingestion → enrichment → indexing → synthesis.  
- **Environment Health Plane integration**:  
  - WSL2/Linux host metrics (CPU, disk, memory).  
  - SLO-style health indicators surfaced from Control Plane v2.4.0.   

---

## 15. Environment Health Plane & Autonomous Recovery

### 15.1 Environment Health Plane

- Monitors WSL2/Linux host: CPU, disk, memory.  
- Feeds metrics into the SLO Dashboard (and dashboard UI in §14).  

### 15.2 Autonomous Recovery Plane

- SLO Metrics Plane (C1) and Recovery Policies Engine (C2).  
- Host-level safeguards:
  - Disk pressure enforcement for ingestion workloads.  
  - CPU saturation enforcement to prevent host lockup.  

---

## 16. Research Archive (Drive)

- Root: `1QyU92RlTFTrlMIGwAUQcRJFf5KtNeskf`  
- Work: `1y71nYLB61V5yFhkNwfltop1OwCR9sXkg`  
- Archive: `1AoXQqJvW609v8mkH0P5qrgVo4PUMCDyy`  

---

## 17. BOB Governance

Follow `META_BOB_V_FINAL_FORM`.  
Factory: `createBOB(config)` in `src/llm/index.js`.  

---

## 18. Governance & Versioning

- Markdown in `projects/cic/docs/` is the source of truth.  
- Git is the authoritative history.  

Current file: **v1.3.1 (patch)** — Corrected Routing section and Document Hierarchy.
