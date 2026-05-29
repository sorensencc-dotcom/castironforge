# CIC Phase 3 MAS — Technical Spec
# v1.1.0 | 2026-05-23

## 1. Architecture
CIC Phase 3 uses a **Pure Function Multi-Agent System (MAS)** driven by a contract-first design.

- **Stateless Agents**: Agents are pure functions (Input → Output) with no internal state or direct DB access.
- **Contract-Driven**: All exchange follows `src/types/agents.ts`.
- **Orchestrator-Led**: `src/orchestrator/orchestrator.p3.ts` sequences execution and handles side effects.
- **LLM Abstraction**: Agents use `src/llm/llmClient.p3.ts` for provider-agnostic LLM tasks.

## 2. Agent Catalog

| Agent | Purpose | Logic |
|---|---|---|
| **Ingestion** | Source → Document | Fetch, normalize, land in storage. |
| **BlockExtractor** | Document → Blocks | Deterministic structural decomposition (HTML/Text). |
| **Enrichment** | Blocks → EnrichedBlocks | LLM-based entity/tag/topic extraction via `extract()`. |
| **Compression** | Enriched → Compressed | Rule-based saliency filtering and optimization. |
| **Synthesis** | Compressed → Artifact | LLM-based narrative generation + citation via `extract()`. |
| **Audit** | Pipeline → Report | Cross-stage validation and quality scoring. |

## 3. LLM Infrastructure (v2.0.0)
The LLM layer provides high-level abstractions:
- **Routing**: Deterministic model selection via `ROUTING_TABLE`.
- **Drift Detection**: Real-time monitoring of latency and token density.
- **Fallback**: Automatic fallback to secondary models on anomaly or failure.
- **Telemetry**: Unique `promptId` tracking for every request.

## 4. Verification & Quality
- **Unit Tests**: Integrated pipeline validation in `tests/p3-pipeline.test.ts`.
- **Golden Tests**: Regression testing against human-verified benchmarks in `tests/p3-golden.test.ts`.

## 5. Execution
Run the full pipeline:
```bash
npx tsx tests/p3-pipeline.test.ts
```

Run golden accuracy tests:
```bash
npx tsx tests/p3-golden.test.ts
```
