# CIC_SYSTEM.md — Cast Iron Charlie Research Engine
# Version: 1.1.0 | Date: 2026-05-17 | Status: ACTIVE
# DO NOT use this file for volatile state — update CIC_PROJECT_STATE.md instead

---

## 1. Project Identity

- **Subject:** Charles Emil Sorensen (1881–1968) — Danish immigrant, Ford Motor Company executive
- **Producer:** Chris Sorensen (great-grandson) via Cast Iron Productions LLC, Tampa FL
- **Deliverable:** Feature documentary + archival research engine
- **Default Claude role:** CIC-RESEARCH (archival + narrative)
- **Alternate Claude role:** CIC-SYSTEM (ingestion + pipeline work)

---

## 2. Document Hierarchy

| Doc Type | File | Location | Purpose |
|---|---|---|---|
| SYSTEM | `CIC_SYSTEM.md` | `integrations/google-drive-mcp/cast-iron-charlie/` | Stable architecture (this file) |
| STATE | `CIC_PROJECT_STATE.md` | `integrations/google-drive-mcp/cast-iron-charlie/` | Volatile status — read/update here |
| Living doc | `Treatment.md` | `integrations/google-drive-mcp/cast-iron-charlie/cic-ingestion/living-docs/` | Documentary treatment (authoritative) |
| Living doc | `Kroll_Archive_Log.md` | `integrations/google-drive-mcp/cast-iron-charlie/cic-ingestion/living-docs/` | Archive ingestion log |
| Living doc | `Research_Logs.md` | `integrations/google-drive-mcp/cast-iron-charlie/cic-ingestion/living-docs/` | Daily/topic research logs |
| Living doc | `QuestionsForDad.md` | `integrations/google-drive-mcp/cast-iron-charlie/cic-ingestion/living-docs/` | Interview question bank |

**Rule:** For research/narrative → update living docs. For current status/tasks → update STATE doc. For architecture changes → update this file.

---

## 3. Codebase Locations (Monorepo Reorg complete 2026-05-17)

### Primary Monorepo Root
```
/mnt/c/Users/soren/
```

### CIC Project Core (Multi-Agent Research)
```
/mnt/c/Users/soren/projects/cic/
```
- Python core (agents, pipelines)
- Location of `CIC_SYSTEM.md` baseline

### CIC Ingestion System (Baseline Ingestion)
```
/mnt/c/Users/soren/
```
- `src/`: Core ingestion logic (JS/ESM)
- `scripts/`: Execution scripts
- `config/`: Path and source configurations

### Integrations
- `integrations/google-drive-mcp/`: Drive orchestration and living docs.
- `integrations/postiz/`: Social media engine.

---

## 4. Module Map (Monorepo Baseline)

```
src/
  audit/            — anomalyDetector, auditAgent, auditStore
  corpus/           — corpus-builder
  db/               — migrate, queries (SQLite via better-sqlite3, WAL mode)
  extractor/        — iExtractor, extractorRegistry, extractorRunner,
                      ImageAnalyzerV2.js (v2 — active), extractorEnricher
  harvester/        — harvester, extractor
  indexer/          — indexer, bundle-builder
  ingestion/        — ingestionAgent, ingestionSchema, ingestionServer, ingestionValidator
  lib/              — classifier, folder-validator, logger, paths, sidecar, status
  providers/        — searxng-cic.ts
  sweeper/          — daily-sweeper
  synthesis/        — briefBuilder, briefStore, synthesisAgent
```

---

## 5. Extractor Architecture

### Pattern: IExtractor (`src/extractor/`)
Functional module. Interface: `meta { id, version, accepts[] }` + `extract(job)` + `healthCheck()`

### ImageAnalyzerV2 (id: `image_analyzer_v2`, v2.0.0)
Sub-extractors (parallel via Promise.allSettled, failure-isolated):
1. `extractSceneGraph` — objects, spatial layout, era, dominantColors
2. `extractFaceClusters` — face detection, bounding boxes [0,1], stable cluster IDs
3. `extractPlaceRecognition` — landmarks, architectural heuristics, indoorOutdoor
4. `extractCrossReferences` — public figures, locations, evidence bundle

Requires: `GEMINI_API_KEY` env var.
**Integration status: functional — wired to pipeline via scripts/run-enricher.js**

---

## 6. DB Schema (SQLite, WAL mode)

File: `/mnt/c/Users/soren/cic_test_root/cic.db` (Absolute path in `config/paths.json`)
Tables: `runs`, `files`, `entities`, `topics`, `bundles`, `bundle_files`, `corpus_entries`.
Update: `runs` table now includes `files_indexed` column.

---

## 7. npm Scripts (Root package.json)

| Script | Command | Notes |
|---|---|---|
| `npm run harvest` | `node scripts/run-harvester.js` | |
| `npm run sweep` | `node scripts/run-sweeper.js` | |
| `npm run enrich` | `node scripts/run-enricher.js` | |
| `npm run index` | `node scripts/run-indexer.js` | |
| `npm run corpus` | `node scripts/run-corpus.js` | |
| `npm run pipeline` | `node scripts/run-pipeline.js` | Full automation |
| `npm run synthesis` | `node scripts/run-synthesis.js` | |
| `npm run audit` | `node scripts/run-audit.js` | |

---

## 8. Known Technical Debt

| Issue | Impact | Workaround |
|---|---|---|
| Permission Denied on root cleanup | Empty `cic/` and `rewritelabs.io/` folders persist | Ignore or use `sudo` if critical |
| No `.env` file | Environment variables must be set inline | Create `.env` |

---

## 9. Research Archive (Google Drive)

Root folder ID: `1QyU92RlTFTrlMIGwAUQcRJFf5KtNeskf`
Working folder: `1y71nYLB61V5yFhkNwfltop1OwCR9sXkg` (treatments, QuestionsForDad, FamilyArchive)
Research Archive: `1AoXQqJvW609v8mkH0P5qrgVo4PUMCDyy`

---

## 10. BOB Governance

All multi-file changes follow META_BOB_V_FINAL_FORM spec.
Factory: `createBOB(config)` from `src/llm/index.js`.
Reference: `integrations/google-drive-mcp/cast-iron-charlie/reference_meta_bob_spec.md`
