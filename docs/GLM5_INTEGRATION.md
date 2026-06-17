# GLM-5 ↔ CIC Integration Specification

**Date:** 2026-06-17  
**Status:** Implementation Phase 1  
**Semver:** 0.1.0

---

## Executive Summary

This specification documents the deterministic, multi-phase integration of GLM-5 into CIC (Cast Iron Charlie), a research cataloging platform.

GLM-5 is explicitly designed for "agentic engineering," long-horizon reasoning, and end-to-end software development. This integration aligns CIC's ingestion, enrichment, orchestration, and audit pipelines with GLM-5's ARC-optimized (Agentic, Reasoning, Coding) architecture.

---

## Integration Goals

GLM-5 serves four critical functions in CIC:

1. **INGEST** — GLM-5's long-context fidelity (200k–1M tokens) powers TorqueQuery ingestion
2. **ENRICH** — ARC-optimized reasoning + structured output for entity extraction and dependency graphs
3. **ORCHESTRATE** — Multi-phase agent workflows via GLM-5.1 (fast agentic tasks)
4. **SYNTHESIZE** — SOTA coding performance via GLM-5.2 for repo-scale refactors and edits

---

## Model Roles

| Phase | GLM-5 Variant | Context | Reasoning | Use Case |
|-------|---------------|---------|-----------|----------|
| Ingestion (TorqueQuery) | GLM-5.2 | 200k–1M | high | Hierarchical summaries, entity extraction, index hints |
| Chat/Edit | GLM-5.1 | ≤128k | high/max | Fast DOM/code edits, design variants |
| Refactoring | GLM-5.2 | ≤200k | max | Repo-scale refactors, architectural changes |
| Orchestration | GLM-5.1 | ≤128k | max | Multi-phase agent loops, self-healing |
| Roadmap Simulation | GLM-5 (base) | 256k+ | high | Long-horizon planning, risk analysis |

---

## CIC Routing Layer (Deterministic)

The CICRouter is the central decision engine. All requests flow through it:

```
Chat Request
    ↓
CICRouter.classify()  [GLM-5.1]
    ↓
Router Decision
    ├─ task_type (dom_edit, code_edit, refactor, search, cic_task)
    ├─ model (glm-5.1, glm-5.2, or glm-5)
    ├─ reasoning_effort (low, high, max)
    └─ context_budget (short or long)
    ↓
CICRouter.execute()
    ├─ Assemble context
    ├─ Load prompt pack
    └─ Call GLM-5
    ↓
Edit Protocol (JSON)
    └─ DOMPatch, CodeEdit, RefactorPlan, Answer
```

### Routing Rules

**Task Type → Model Selection:**

- **DOM Edit (local)** → GLM-5.1, reasoning_effort=high
- **DOM Edit (multi-file)** → GLM-5.2, reasoning_effort=high
- **Design Variant** → GLM-5.2, reasoning_effort=high
- **Code Edit (single file)** → GLM-5.2, reasoning_effort=high
- **Code Edit (repo-scale)** → GLM-5.2, reasoning_effort=max
- **Refactor** → GLM-5.2, reasoning_effort=high/max (by scope)
- **Search** → GLM-5.1 (short) or GLM-5.2 (long context)
- **CIC Task** (build fix, multi-phase) → GLM-5.1, reasoning_effort=max

### Parameter Policy

```typescript
interface RoutingDecision {
  model: "glm-5.1" | "glm-5.2" | "glm-5";
  reasoning_effort: "low" | "high" | "max";
  enable_thinking: false; // Always deterministic for user-facing edits
  context_mode: "short" | "long";
  should_call_torquequery: boolean;
}
```

---

## TorqueQuery Integration (Phase 2)

### Ingestion Pipeline

**Corpus → GLM-5.2 (long-context) → Index**

1. Chunk corpus into 200k–800k token slices
2. GLM-5.2 ingestion pass:
   - Hierarchical summaries (global → section → file)
   - Entity extraction (APIs, components, services, routes, types)
   - Dependency graphs (who-uses-whom)
   - Index hints (BM25 terms + semantic anchors)
3. TorqueQuery indexes:
   - **Lexical** (BM25): term postings
   - **Vector**: embeddings of summaries + semantic anchors
   - **Graph**: dependency relations

### Query Pipeline

**Query → TorqueQuery → GLM-5 → Answer/Plan**

1. User sends query (e.g., "Where is NavBar used?")
2. TorqueQuery retrieves:
   - Top matching documents (BM25 + vectors + RRF)
   - Metadata (summaries, entities, relations)
3. Adapter builds context frame
4. Route to GLM-5:
   - GLM-5.1 for short context (≤3 docs)
   - GLM-5.2 for long context (>3 docs or repo-scale)
5. GLM-5 synthesizes:
   - Answer with locations
   - Refactor plan (if query implies change)

---

## Chat Engine Integration (Phase 3)

### Flow Diagram

```
Chat Edit Session
    ↓
ChatRequestEnvelope
    (user_message, dom_snapshot, active_file, mode)
    ↓
CICRouter.classify()
    ↓
Router Decision
    ├─ task_type
    ├─ model
    └─ should_call_torquequery
    ↓
[Optional] TorqueQuery call (for search-aware edits)
    ↓
AssembleContext()
    (dom_context + code_context + design_context + cic_context)
    ↓
LoadPromptPack() [e.g., "dom_design_glm5_v1"]
    ↓
GLM5Client.call()
    ↓
EditProtocol (JSON)
    (dom_edit, design_variant, code_edit)
    ↓
Chat Engine applies patches
    (DOMPatch Applicator, CodeEditor, DesignVariantRenderer)
```

### Unified Request Envelope

```typescript
interface ChatRequestEnvelope {
  session_id: string;
  user_message: string;
  mode: "chat" | "edit" | "design" | "code";
  dom_snapshot?: { element_tree, active_selector, computed_styles };
  active_file?: string;
  active_component?: string;
  recent_edits?: EditRecord[];
  cic_state?: { build_status, open_prs, known_issues };
}
```

### Context Frames

Every GLM-5 call receives a unified frame:

```typescript
interface UnifiedContextFrame {
  user_intent: string;
  dom_context?: DOMContext;
  code_context?: CodeContext;
  design_context?: DesignContext;
  cic_context?: CICContext;
  search_context?: SearchContext;
}
```

---

## Unified Edit Protocol

All GLM-5 responses are **JSON-only** and **deterministic**.

### Schemas

#### DOM Edit
```json
{
  "action": "dom_edit",
  "target": { "selector": "#header", "component": "Header" },
  "patches": [
    { "path": "style.backgroundColor", "value": "#001133" }
  ],
  "explanation": "Darken header for contrast"
}
```

#### Code Edit
```json
{
  "action": "code_edit",
  "file": "src/components/NavBar.tsx",
  "diff": "--- a/...\n+++ b/...\n@@ -10,3 +10,5 @@\n",
  "explanation": "Extracted responsive logic"
}
```

#### Refactor Plan
```json
{
  "action": "refactor_plan",
  "scope": "repo_scale",
  "steps": [
    { "id": "step_1", "description": "Extract layout component", "files": [...] }
  ]
}
```

#### Search Answer
```json
{
  "action": "answer",
  "response": "NavBar is used in Home.tsx and About.tsx",
  "locations": ["src/pages/Home.tsx:45", "src/pages/About.tsx:30"]
}
```

---

## CIC Multi-Agent Loop (Phase 4)

GLM-5.1 orchestrates the multi-phase workflow:

```
1. DISCOVER
   ├─ Classify task
   ├─ Plan phases
   └─ Identify dependencies
   
2. HARVESTER
   ├─ Call TorqueQuery
   ├─ Assemble artifacts
   └─ Build context
   
3. REDESIGN
   ├─ Architectural reasoning (GLM-5.2 if large)
   ├─ Generate patches
   └─ Plan validation
   
4. OUTREACH
   ├─ Apply patches
   ├─ Create PRs
   ├─ Run tests
   └─ Update issues
   
5. DELIVERY
   ├─ Consolidate results
   ├─ Generate summary
   └─ Record artifacts
   
6. AUDIT
   ├─ Consistency checks
   ├─ Test runs
   └─ Self-healing (fallback strategies)
```

---

## Repo-Scale Coding & Refactors

GLM-5.2's long-context and coding strength:

1. **TorqueQuery** assembles repo context (architecture, key files, types)
2. **GLM-5.2** performs:
   - Architecture analysis
   - Refactor planning
   - Patch generation
3. **CIC applies patches** → runs tests → **GLM-5.1 audits**

---

## Roadmap Simulation

GLM-5 base model for long-horizon planning:

- Simulate CIC multi-month evolution
- Evaluate risk/payoff of new agents
- Propose phased rollouts
- Identify failure modes

---

## Observability & Determinism

### Telemetry Per Call

```typescript
interface CallObservability {
  call_id: string;
  timestamp: number;
  model: ModelVariant;
  reasoning_effort: ReasoningEffort;
  enable_thinking: boolean;
  prompt_template_id: string;
  context_size: number;
  task_type?: TaskType;
  scope?: Scope;
  latency_ms: number;
  success: boolean;
  error?: string;
}
```

### Guardrails

- **Context limits**:
  - GLM-5.1: max 128k tokens
  - GLM-5.2: 200k–1M (variant-dependent)
  - Fallback: shrink context → retry with GLM-5.1

- **JSON validation**:
  - Enforce edit protocol schema
  - Request schema correction on failure
  - Log validation errors

- **Determinism**:
  - enable_thinking=false for user-facing chat edits
  - Reproducible prompt templates (versioned)
  - Seeded randomness for testing

---

## Implementation Phases

### Phase 1: Core Router & Types (Current)
- ✅ Type definitions (unified context, edit protocol)
- ✅ CICRouter (classification + routing)
- ✅ GLM5Client (deterministic API wrapper)
- ✅ Prompt packs (versioned templates)

### Phase 2: TorqueQuery Adapter
- Ingestion pipeline (corpus → GLM-5.2 → index)
- Query pipeline (TorqueQuery → GLM-5 → answer)
- BM25, vector, and graph indexing
- Integration tests

### Phase 3: Chat Engine Integration
- ChatRequestEnvelope → CICRouter flow
- DOM/code/design edit patches
- DesignVariantRenderer integration
- Browser testing

### Phase 4: CIC Orchestrator
- Multi-phase workflow engine
- Tool call orchestration
- PR creation and issue updates
- Self-healing fallbacks

### Phase 5: Roadmap Simulation
- Long-horizon planning prompts
- Risk/payoff analysis
- Phased rollout proposal
- Failure mode detection

---

## Design Decisions

### Why GLM-5.1 for Chat, GLM-5.2 for Deep Work?

- **GLM-5.1**: Faster, excellent for agentic tasks, tool calls, orchestration
- **GLM-5.2**: Longer context (up to 1M), SOTA coding, architectural reasoning

### Why JSON-Only Edit Protocol?

- Deterministic parsing and validation
- Prevents hallucinated prose
- Enables automated testing and reproducibility

### Why Unified Context Frames?

- All GLM-5 calls see consistent information
- Reduces prompt engineering surface area
- Easier to audit and debug

### Why Version Prompt Packs?

- Reproducibility across runs
- Ability to A/B test prompt variations
- Clear lineage for error analysis

---

## Success Criteria

- [ ] CICRouter classifies all request types correctly
- [ ] GLM-5.1 fast agentic tasks (< 5s latency)
- [ ] GLM-5.2 deep reasoning (< 30s for repo-scale)
- [ ] Edit protocol compliance: 100% valid JSON
- [ ] Chat Engine accepts all edit types
- [ ] TorqueQuery queries answered within 10s
- [ ] CIC Orchestrator completes multi-phase workflows
- [ ] Roadmap simulator proposes viable plans

---

## References

- GLM-5 Technical Documentation: https://docs.example.com/glm5
- CIC Architecture: See ../ARCHITECTURE.md
- Rewrite Labs Coding Standards: See ../CONTRIBUTING.md
- Unified Edit Protocol: See EDIT_PROTOCOL.md
