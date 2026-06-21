# CIC Typesense Indexer Integration Checklist

**Objective:** Integrate all 10 subsystems from the production Typesense code indexer into CIC's architecture layers.

**Timeline:** 3-4 days, parallelizable per subsystem.

**Owner:** DevOps / Platform team.

---

## Pre-Integration Verification

- [ ] Typesense indexer PR #37 is merged to main
- [ ] All 9 subsystem files present in typesense-indexer/src/
- [ ] No compile errors: `cd typesense-indexer && npm run build`
- [ ] Indexer runs standalone: `npm run dev` (watch active, files indexed)
- [ ] Typesense responds to health check: `curl http://localhost:8108/health`

---

## Subsystem 1: config.ts → CIC Config Registry

**Purpose:** Centralize repo paths, Typesense connection, ignore patterns, language mappings.

### Integration Tasks

- [ ] **1.1 Extract config constants**
  - Read `typesense-indexer/src/config.ts`
  - Identify all `getEnv()` calls and defaults
  - List: REPO_ROOT, TYPESENSE_HOST, TYPESENSE_PORT, TYPESENSE_API_KEY, IGNORE_PATTERNS, LANGUAGE_PATTERNS

- [ ] **1.2 Create CIC config schema**
  - Define in CIC's Config Registry format (YAML or JSON Schema)
  - Add fields: indexer.enabled, indexer.repos[], indexer.typesense.*, indexer.ignorePatterns[]
  - Add environment overrides: dev, staging, prod

- [ ] **1.3 Add CIC Phase metadata**
  - Add indexer.phase (default: "26")
  - Add indexer.adapter (default: empty, allows repo-specific adapters)
  - Add indexer.tags[] for filtering (e.g., ["cic", "ingestion", "phase26"])

- [ ] **1.4 Wire into CIC bootstrap**
  - Import config registry in main.ts
  - Replace `getEnv()` calls with `registry.get("indexer.*")`
  - Add validation: all required fields present
  - Add startup log: "Indexer config loaded from registry"

- [ ] **1.5 Verify in all environments**
  - `npm run dev` reads from dev registry
  - `npm run build && npm start` reads from prod registry
  - Logs show correct config values

**Expected Outcome:** Config centralized, environment-aware, Phase-tagged.

---

## Subsystem 2: logger.ts → CIC Unified Logging Layer

**Purpose:** Structured logging with JSON, timestamps, levels.

### Integration Tasks

- [ ] **2.1 Audit current logger**
  - Check `typesense-indexer/src/logger.ts` format
  - Identify log levels used: debug, info, warn, error
  - Identify log categories: fs (file system), ast (parsing), typesense (ingestion)

- [ ] **2.2 Align with CIC logging**
  - Verify CIC's unified logger interface (if exists)
  - Map indexer categories to CIC's observability system
  - Add fields: timestamp, level, category, message, context (repo, file, phase)

- [ ] **2.3 Add indexer-specific categories**
  - indexer.fs — file watch events (ADD, CHANGE, DELETE)
  - indexer.ast — symbol extraction, parsing errors
  - indexer.typesense — ingestion, upsert, delete, latency
  - indexer.health — startup, shutdown, errors

- [ ] **2.4 Replace logger.ts**
  - Update all `logger.info()`, `logger.error()`, etc. to use CIC logger
  - Preserve all existing log messages
  - Add context fields: repo, path, phase (where relevant)

- [ ] **2.5 Add observability hooks**
  - Log file watch start/stop
  - Log batch ingest start/count/duration
  - Log errors with stack traces
  - Log performance metrics (parsing time, ingest latency)

- [ ] **2.6 Verify logs in CIC dashboard**
  - Logs appear in CIC Observability Dashboard
  - Logs filterable by category, level, repo
  - Search works for error messages

**Expected Outcome:** Indexer logs integrated into CIC observability, first-class telemetry.

---

## Subsystem 3: typesenseClient.ts → CIC Service Adapter

**Purpose:** Thin wrapper for Typesense API calls.

### Integration Tasks

- [ ] **3.1 Review current client**
  - Check `typesense-indexer/src/typesenseClient.ts`
  - Identify all methods: createCollection, upsertDocuments, deleteDocument, search, etc.
  - Identify connection parameters: host, port, protocol, apiKey

- [ ] **3.2 Register as CIC Service Adapter**
  - Add to CIC's Service Registry
  - Service name: `typesense-indexer`
  - Service type: `data-ingestion`
  - Dependencies: `typesense-cluster` (the Typesense server)

- [ ] **3.3 Add retry/backoff policies**
  - Exponential backoff: 100ms, 200ms, 500ms, 1s (max 5 retries)
  - Circuit breaker: fail-fast after 3 consecutive errors
  - Log all retries and failures with attempt count

- [ ] **3.4 Add health checks**
  - GET /health endpoint in typesenseClient
  - Check Typesense cluster health: `curl http://localhost:8108/health`
  - Return: `{ ok: boolean, latency: number, timestamp: ISO8601 }`
  - Register with CIC's health aggregator

- [ ] **3.5 Add metrics**
  - Track: requests (count), latency (histogram), errors (count by type)
  - Emit to CIC's metrics system (Prometheus or equivalent)
  - Metrics prefix: `cic_indexer_typesense_*`

- [ ] **3.6 Add connection pooling**
  - Reuse HTTP connections to Typesense
  - Pool size: 10 connections (configurable)
  - Connection timeout: 30s
  - Idle timeout: 5m

**Expected Outcome:** Typesense treated as stable internal service with monitoring, retries, health checks.

---

## Subsystem 4: schema.ts → CIC Schema Registry

**Purpose:** Create and validate the code_files collection schema.

### Integration Tasks

- [ ] **4.1 Extract schema definition**
  - Read `typesense-indexer/src/schema.ts`
  - Copy full schema (13 fields: path, repo, language, content, symbols, imports, exports, functions, classes, phase, adapter, todos, modified, size, hash)
  - Note default_sorting_field: "modified"

- [ ] **4.2 Create schema versioning**
  - Schema version: v1 (current)
  - Add migration scripts for future versions
  - Store schema history in CIC's Schema Registry
  - Add changelog: "v1: initial schema for Phase 26"

- [ ] **4.3 Add CIC-specific fields**
  - repo → facet, required
  - phase → facet, required (enable Phase 26, 27, 28 filtering)
  - adapter → facet, optional (enable adapter-specific searches)
  - Add field: ingested_by (who indexed it: agent, worker, batch)
  - Add field: ingestion_timestamp (ISO8601, facet)

- [ ] **4.4 Register in CIC Schema Registry**
  - Name: `code_files`
  - Purpose: "Code search index with metadata extraction"
  - Versioning: enabled
  - Migrations: empty for v1

- [ ] **4.5 Add schema validation**
  - Validate on collection creation
  - Validate on every upsert
  - Reject documents missing required fields
  - Log schema mismatches with document ID and missing fields

- [ ] **4.6 Plan schema evolution**
  - Document migration path: v1 → v2 (if needed)
  - Add migration script template for future versions
  - Document breaking changes clearly

**Expected Outcome:** Schema versioned, evolvable, with CIC Phase/Adapter support, safe migrations.

---

## Subsystem 5: watcher.ts → CIC Ingestion Bus

**Purpose:** Incremental file watcher using chokidar.

### Integration Tasks

- [ ] **5.1 Audit current watcher**
  - Read `typesense-indexer/src/watcher.ts`
  - Identify events: add, change, unlink
  - Identify filters: ignore patterns (node_modules, .git, dist, etc.)
  - Identify batching: debounce time, batch size

- [ ] **5.2 Register as CIC Ingestion Source**
  - Source name: `typesense-file-watcher`
  - Source type: `file-system`
  - Monitoring: repos configured in config.ts
  - Event types: ADD, CHANGE, DELETE

- [ ] **5.3 Add event routing to CIC Ingestion Bus**
  - Emit events to CIC's message bus (Kafka, Redis, or in-process queue)
  - Event format: { type: "ADD"|"CHANGE"|"DELETE", repo, path, timestamp }
  - Add tracing: correlation ID for tracking through pipeline

- [ ] **5.4 Add file-level provenance**
  - Track: who detected change (watcher), when, from which repo
  - Add to document metadata: detected_by, detected_at, detected_repo
  - Enable audit trail: show all indexing history per file

- [ ] **5.5 Add Phase-aware indexing**
  - Read Phase tag from config per repo
  - Tag all documents from that repo with phase
  - Enable filtering by phase in searches

- [ ] **5.6 Add error handling**
  - Catch watcher errors gracefully
  - Log with context: repo, path, error message
  - Add circuit breaker: stop watching if > 10 consecutive errors
  - Add recovery: auto-restart watcher with exponential backoff

- [ ] **5.7 Verify event flow**
  - Create a test file in watched repo
  - Verify ADD event emitted to Ingestion Bus
  - Verify event logged with full context
  - Verify document indexed within 5 seconds

**Expected Outcome:** Real-time code ingestion with full provenance, Phase awareness, error recovery.

---

## Subsystem 6: metadataExtractor.ts → CIC Evidence Packets

**Purpose:** Extract TODOs, FIXMEs, Phase tags, Adapter tags.

### Integration Tasks

- [ ] **6.1 Audit current extractor**
  - Read `typesense-indexer/src/metadataExtractor.ts`
  - Identify patterns extracted: TODO, FIXME, @phase, @adapter, etc.
  - Identify output format: structured object with arrays

- [ ] **6.2 Add CIC-specific tag patterns**
  - Support existing: @phase-27, @adapter:WarmPool, TODO, FIXME
  - Add new: @cic:ingestion, @cic:critical, @cic:deprecated
  - Add regex patterns: case-insensitive, handle variations
  - Document patterns in config

- [ ] **6.3 Add to CIC Evidence Packets**
  - Create evidence packet per indexed file
  - Evidence packet format: { repo, path, extracted_metadata, extracted_at, confidence }
  - Include: phase tags, adapter tags, TODO/FIXME, symbols (from AST)

- [ ] **6.4 Add to TorqueQuery multi-collection**
  - Push extracted metadata to TorqueQuery's metadata index
  - Enable: search by phase, adapter, TODO status
  - Enable: faceted search on metadata fields

- [ ] **6.5 Add metadata validation**
  - Validate phase values: must match CIC phases (23-28, etc.)
  - Validate adapter names: must be known adapters
  - Log warnings for unknown tags
  - Reject invalid metadata or quarantine for review

- [ ] **6.6 Add metadata versioning**
  - Track extraction version: v1 (current)
  - Enable migration if patterns change
  - Document pattern version with each extraction

**Expected Outcome:** Rich metadata extracted, CIC-tagged, integrated into evidence packets and TorqueQuery.

---

## Subsystem 7: astParser.ts → CIC Structural Extractors

**Purpose:** Extract symbols, functions, classes, imports, exports.

### Integration Tasks

- [ ] **7.1 Audit current parser**
  - Read `typesense-indexer/src/astParser.ts`
  - Identify supported languages: TypeScript, JavaScript, Python, others
  - Identify extractions: symbols, functions, classes, imports, exports
  - Identify output format: arrays of strings or objects with metadata

- [ ] **7.2 Register as CIC Structural Extractor**
  - Extractor name: `typesense-ast-parser`
  - Extractor type: `code-structure`
  - Languages supported: [ts, js, py, md, ...]
  - Confidence level: high (deterministic parsing)

- [ ] **7.3 Add language-specific adapters**
  - TypeScript/JavaScript: use existing parser (babel, typescript, etc.)
  - Python: add python AST parser
  - Markdown: add frontmatter + code block extraction
  - Add pluggable pattern: new languages can register adapters

- [ ] **7.4 Add error-tolerant parsing**
  - Catch parse errors gracefully
  - Return partial results (what could be parsed)
  - Log errors with file, line number, error type
  - Add quarantine: flag files with persistent parse errors for review

- [ ] **7.5 Add symbol graph extraction**
  - Build directed graph: imports → exports → symbols used
  - Extract call chains: function A calls function B calls function C
  - Store in CIC's call-graph engine (if exists)
  - Enable: "show me all callers of this function"

- [ ] **7.6 Add scope analysis**
  - Track local vs. exported symbols
  - Track symbol types: function, class, constant, type, interface, etc.
  - Include location: line number, column
  - Enable: "find where symbol is defined"

- [ ] **7.7 Verify extraction quality**
  - Sample 100 files
  - Validate symbol count: > 0 for non-empty files
  - Validate imports/exports parse correctly
  - Log statistics: avg symbols/file, avg functions/file, parse errors

**Expected Outcome:** CIC can reason about code structure, call chains, scope, language-agnostic.

---

## Subsystem 8: indexer.ts → CIC Ingestion Core

**Purpose:** Upsert/delete logic with SHA-256 deduplication.

### Integration Tasks

- [ ] **8.1 Audit current indexer**
  - Read `typesense-indexer/src/indexer.ts`
  - Identify operations: upsert, delete, batch
  - Identify deduplication: SHA-256 hash of content
  - Identify conflict resolution: last-write-wins

- [ ] **8.2 Add CIC provenance fields**
  - Add to every document: indexed_by (agent/worker ID), indexed_at (timestamp)
  - Add to every document: repo, phase, adapter (from config)
  - Add to every document: confidence_score (1.0 for file content, < 1.0 for extracted metadata)

- [ ] **8.3 Add index drift detection**
  - Periodically check: is the indexed version same as on-disk version?
  - Compare SHA-256 hash: if mismatch, document is stale
  - Report stale documents: count, list, which repos
  - Add to observability: `cic_indexer_stale_documents_total`

- [ ] **8.4 Add reindex-on-hash-change**
  - If content hash changes, re-ingest automatically
  - Re-run metadata extraction and AST parsing
  - Log all changes: what changed, when, why
  - Preserve history: old version available via timestamp query

- [ ] **8.5 Add CIC retry + backoff**
  - Failed upsert: retry with exponential backoff (100ms, 200ms, 500ms, 1s)
  - Max retries: 5
  - After max retries: quarantine document, alert admin
  - Log all retries with attempt count and error

- [ ] **8.6 Add batch optimization**
  - Batch size: 100 documents (configurable)
  - Batch timeout: 5 seconds (send partial batch if timeout)
  - Parallelize: send batches in parallel (e.g., 3 concurrent batches)
  - Metrics: batch count, batch latency, throughput (docs/sec)

- [ ] **8.7 Add idempotency**
  - Upsert by document ID (repo + path) is idempotent
  - Same document indexed twice = same state
  - Enable replay: re-index doesn't corrupt index

**Expected Outcome:** Deterministic, self-healing ingestion with provenance, retry logic, performance optimization.

---

## Subsystem 9: main.ts → CIC Microservice

**Purpose:** Bootstrap the entire indexer.

### Integration Tasks

- [ ] **9.1 Audit current bootstrap**
  - Read `typesense-indexer/src/main.ts`
  - Identify startup sequence: config → logger → Typesense → watcher → indexer
  - Identify shutdown sequence: close watcher → close Typesense → exit
  - Identify error handling: unhandled rejections, signals (SIGTERM, SIGINT)

- [ ] **9.2 Register as CIC Ingestion Service**
  - Service name: `typesense-indexer`
  - Service role: `data-ingestion`
  - Service tier: `critical` (CIC cannot function without indexed code)
  - Replicability: stateless (can restart without data loss)

- [ ] **9.3 Add lifecycle hooks**
  - `onStart()` — initialize config, logger, Typesense, watcher
  - `onStop()` — graceful shutdown (close watcher, flush pending batches)
  - `onReload()` — reload config, apply changes without restart
  - `onHealth()` — return health status: healthy/degraded/unhealthy

- [ ] **9.4 Add health endpoints**
  - GET /health — JSON: { status, timestamp, checks: { typesense, watcher, batching } }
  - GET /metrics — Prometheus metrics (latency, errors, throughput)
  - GET /status — JSON: { running_since, documents_indexed, last_error, uptime_seconds }
  - Enable integration with CIC's health aggregator

- [ ] **9.5 Add graceful shutdown**
  - Handle SIGTERM: stop accepting new files, flush pending batches, close connections
  - Timeout: 30 seconds to shutdown (else force kill)
  - Log shutdown sequence: "Indexer shutting down...", "Flushing batches...", "Typesense closed.", "Bye."

- [ ] **9.6 Add integration with CIC Service Mesh**
  - Register service: name, port, health endpoint
  - Service discovery: can other CIC services find the indexer?
  - Load balancing: (if multiple indexers, distribute repos)
  - Tracing: add correlation IDs to all logs

- [ ] **9.7 Add startup diagnostics**
  - Log on startup: config loaded, repos monitored, Typesense connected
  - Run health checks: all dependencies available
  - Log any warnings (e.g., ignoring non-existent repo)
  - Set ready flag only when indexer is fully operational

**Expected Outcome:** Indexer is managed CIC microservice with lifecycle, health, observability, graceful shutdown.

---

## Subsystem 10: README.md → CIC Migration Docs

**Purpose:** Developer documentation for the indexer.

### Integration Tasks

- [ ] **10.1 Audit current README**
  - Read `typesense-indexer/README.md`
  - Identify sections: installation, usage, configuration, troubleshooting
  - Identify examples: basic usage, environment variables, CLI commands

- [ ] **10.2 Move into CIC Migration Docs**
  - Location: `docs/PHASE26_INDEXER_GUIDE.md` (or equivalent)
  - Add link from main CIC docs
  - Add to migration timeline (before Phase 27)

- [ ] **10.3 Add Phase-26 integration notes**
  - Section: "Indexer in CIC Phase 26"
  - Explain: indexer is part of Code Search tier
  - Explain: what indexer enables (deterministic search, evidence packets)
  - Explain: dependencies (Typesense, repos configured)

- [ ] **10.4 Add agent usage examples**
  - Section: "Using the Indexer from Agents"
  - Example: query TorqueQuery gateway for indexed code
  - Example: ground agent answers in verified code
  - Example: call torque_query tool from agent code

- [ ] **10.5 Add TorqueQuery integration examples**
  - Section: "Indexer + TorqueQuery Integration"
  - Example: API calls to /keyword, /semantic, /hybrid
  - Example: search by phase, adapter, repo
  - Example: get facets for filtering

- [ ] **10.6 Add troubleshooting guide**
  - Section: "Troubleshooting"
  - Problem: "Files not indexed"
  - Solution: verify watcher running, check logs, verify Typesense connected
  - Add common errors: connection refused, parse errors, permission denied

- [ ] **10.7 Add deployment guide**
  - Section: "Deployment"
  - Docker: build image, run container, verify health
  - Kubernetes: example manifest, resource limits, health checks
  - Manual: npm install, npm start, monitor logs

**Expected Outcome:** Comprehensive guide for CIC developers, integration examples, troubleshooting, deployment.

---

## Integration Validation

After completing all subsystems, verify end-to-end:

- [ ] **Config flows to all subsystems**
  - Config loaded from registry
  - All subsystems read from config
  - Environment overrides work

- [ ] **Logging integrated**
  - All indexer logs appear in CIC observability
  - Logs filterable by category, level
  - Error logs trigger alerts

- [ ] **Typesense service registered**
  - Service listed in CIC Service Registry
  - Health checks passing
  - Metrics available in Prometheus

- [ ] **Schema versioned**
  - Schema v1 exists in registry
  - Migration path documented for v2
  - All documents valid against schema

- [ ] **Events flowing through Ingestion Bus**
  - File change generates event
  - Event routed through bus
  - Event triggers indexing

- [ ] **Metadata extracted and captured**
  - Phase tags extracted
  - Adapter tags extracted
  - Evidence packets created

- [ ] **AST parsing working**
  - Symbols extracted for TypeScript files
  - Imports/exports parsed
  - Call graph available

- [ ] **Indexing deterministic**
  - Same file indexed twice = identical result
  - SHA-256 dedup working
  - Idempotent upserts

- [ ] **Service lifecycle functional**
  - Service starts cleanly
  - Service stops gracefully
  - Health endpoint responsive
  - Metrics available

- [ ] **Documentation complete**
  - README integrated into CIC docs
  - Phase-26 notes added
  - Agent examples provided
  - Deployment guide available

---

## Completion Checklist

- [ ] All 10 subsystems integrated into CIC
- [ ] All 10 validation points passed
- [ ] Documentation complete and published
- [ ] Team trained on new indexer integration
- [ ] Production deployment plan documented
- [ ] Rollback plan documented (if needed)

---

## Success Criteria

✅ **Indexer Integrated into CIC**
- Indexer is managed CIC microservice
- All subsystems integrated into corresponding CIC layers
- Configuration centralized and environment-aware
- Logging integrated into observability
- Service registered with health checks and metrics
- Schema versioned with migration path
- Events flowing through Ingestion Bus
- Metadata and AST extracted and captured
- Indexing deterministic and self-healing
- Documentation complete

✅ **Ready for Phase 27**
- Code search fully functional
- Agents can query verified code
- No hallucinations (all answers grounded)
- Performance targets met

---

**Status:** 🚀 Integration Tier 1 Ready

**Timeline:** 3-4 days after Phase 26 merge

**Next:** Phase 27 (Query Planner, caching, webhooks)

---

**Owner:** DevOps / Platform team

**Contact:** [CIC Platform Lead]

**Last Updated:** 2026-06-21
