# CIC v2.3 Routing Spec — Operator Grade
# v2.3.0 | 2026-05-30

## 1. Objective
Maximize **Token Economy** by implementing a "Local-First, Cloud-Only for Reasoning" routing architecture. This spec defines the deterministic routing rules for all 10 CIC subsystems.

---

## 2. Inference Tier Definitions

| Tier | Capability | Examples | Cost |
|---|---|---|---|
| **L0 (Local-Deterministic)** | RegEx, NLP, Rules | Spacy, Tesseract, custom scripts | $0 |
| **L1 (Local-Inference)** | Small LLMs (7B-14B) | Llama 3, Mistral, Qwen (via Ollama/vLLM) | $0 |
| **C1 (Cloud-Flash)** | Fast, cheap cloud | Gemini 2.0 Flash, Claude 3.5 Haiku | Low |
| **C2 (Cloud-Pro)** | High-reasoning, long-context | Gemini 2.0 Pro, Claude 3.7 Sonnet | High |

---

## 3. Subsystem Routing Table

| Subsystem | Primary Tier | Fallback Tier | Logic |
|---|---|---|---|
| **Discovery** | L1 | C1 | Classify document type, metadata extraction. |
| **Harvester** | L0 + L1 | C1 | Local hash, OCR, and first-pass extraction. |
| **Redesign** | C2 | C1 | High-entropy architectural reasoning. |
| **Outreach** | C1 | L1 | Templated generation with cloud refinement. |
| **Delivery** | L0 | C1 | Schema validation and final formatting. |
| **Arbitration** | C2 | N/A | Conflict resolution between agents. |
| **Divergence Engine** | L1 | C1 | Drift detection and anomaly triage. |
| **Observability** | L0 | N/A | Local metrics aggregation and dashboard. |
| **TokenEconomy** | L1 | C1 | Cost analysis and routing optimization. |
| **Fallback Engine** | L0 | N/A | Hardcoded rules for state recovery. |

---

## 4. Agent Decision Trees (Hybrid Pipelines)

### 4.1 Harvester Loop
1. **Local (L0)**: Hash file, extract EXIF/MIME.
2. **Local (L1)**: Summarize text to < 1k tokens.
3. **Cloud (C1)**: (Optional) If L1 confidence < 0.8, use C1 for entity extraction.
4. **Local (L0)**: Land in DB.

### 4.2 Redesign Loop
1. **Cloud (C2)**: Full context synthesis (doc + system specs).
2. **Local (L1)**: Validate generated code against local linter/parser.
3. **Cloud (C2)**: (Retry) If L1 fails, feed error back to C2.

---

## 5. Cost-Aware Fallback Logic

Autonomous model switching is triggered by the `TokenEconomyAgent` when:
- **Latency Inflation**: Current latency > 1.5x baseline.
- **Token Leak**: Input tokens spike > 50% without content increase.
- **Drift Anomaly**: Drift score > 0.35 (detected in `llmClient.p3.ts`).

### Fallback Priority:
1. `C2` → `C1` (Reasoning downgrade, cost save)
2. `C1` → `L1` (Inference downgrade, cost zero)
3. `L1` → `L0` (Functional downgrade, safety mode)

---

## 6. Arbitration & Divergence Protocol

When two agents (e.g., Synthesis and Audit) disagree:
1. **Local Triage (L1)**: Compare outputs and flag specific divergence points.
2. **Cloud Arbitration (C2)**: Single "Judge" prompt with both outputs + source context.
3. **Final Resolution**: C2 output is final; L1 records the divergence for observability.

---

## 7. Implementation Hooks

### 7.1 LLM Layer Update (`src/llm/llmClient.p3.ts`)
```typescript
const ROUTING_POLICY = {
  enrichment: { primary: 'L1', fallback: 'C1' },
  synthesis:  { primary: 'C1', fallback: 'C2' }, // C2 if C1 fails quality
  redesign:   { primary: 'C2', fallback: 'C1' }
};
```

### 7.2 Telemetry Extension
Standardize `tier` field in `PromptTelemetry` to track efficiency of Local vs Cloud usage.

---

## 8. Governance Integration
- `SecuritySentinelAgent` (L0) scans all cloud-bound prompts for PII/Secrets.
- `TokenEconomyAgent` (L1) calculates "Tokens Saved" vs. "Cloud Budget".

---
**Status: READY FOR IMPLEMENTATION**
