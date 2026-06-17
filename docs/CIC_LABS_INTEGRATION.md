# CIC ↔ Rewrite Labs Unified GLM-5 Integration

**Date:** 2026-06-17  
**Status:** Architecture Specification  
**Semver:** 0.1.0

---

## Executive Summary

CIC (Cast Iron Charlie) and Rewrite Labs are two distinct agentic systems serving different purposes:

- **CIC**: Internal development engine (repo refactoring, code generation, multi-phase workflows)
- **Rewrite Labs**: External redesign business (site analysis, design generation, outreach, lead scoring)

Rather than building separate GLM-5 integrations, both systems **share a unified GLM-5 fleet and router** with mode-specific task routing.

This document defines how they coexist within a single, deterministic infrastructure.

---

## Shared Infrastructure

### Layer 1: GLM-5 Fleet (Shared)

```
┌─────────────────────────────────────────┐
│         GLM-5 API Client                │
│  (glm5Client.js - Node 20+ ESM)         │
│                                         │
│  - glm-5.1 (agentic tasks)             │
│  - glm-5.2 (long-context reasoning)    │
│  - glm-5 (744B, strategist)            │
└─────────────────────────────────────────┘
```

**Key Properties:**
- Deterministic defaults (temperature=0, top_p=1)
- Structured JSON logs
- Boundary validation (API key, base URL, logger)
- Fallback logic (5.2 → 5.1 on failure)
- `callJSON()` helper for strict JSON output

### Layer 2: Unified Router (Mode-Based)

```
┌──────────────────────────────────────────────────────┐
│            Unified Router                            │
│  - route(mode: "cic"|"labs"|"chat", envelope)       │
│  - assembleContext(mode, envelope)                  │
│  - execute(mode, decision, context, prompt)         │
└──────────────────────────────────────────────────────┘
        │              │              │
        ▼              ▼              ▼
    ┌──────┐      ┌───────┐     ┌──────┐
    │ CIC  │      │ Labs  │     │Chat  │
    │Mode  │      │ Mode  │     │ Mode │
    └──────┘      └───────┘     └──────┘
```

**Router Responsibilities:**
- Classify task by mode
- Select model (5.1, 5.2, or base)
- Determine reasoning effort
- Load appropriate prompt pack
- Assemble unified context frame
- Execute GLM-5 call

### Layer 3: Shared Indexing (TorqueQuery)

**CIC Usage:**
- Index repo code, docs, architecture
- Search for dependencies, patterns, usage

**Labs Usage:**
- Index site structure, content, DOM
- Search for design patterns, components
- Extract metadata for redesign context

Both use the same hybrid index (BM25 + vectors + graphs).

### Layer 4: Shared Edit Protocols

**Core Edit Protocol (CIC):**
```json
{
  "action": "dom_edit|code_edit|refactor_plan|answer",
  ...
}
```

**Redesign Protocol (Labs):**
```json
{
  "action": "site_redesign|component_redesign|outreach|lead_score",
  ...
}
```

Both are strict JSON with deterministic schemas.

---

## Mode-Specific Routing

### CIC Mode: Internal Development

**Task Types:**
- `cic_discover` - Classify work, create plan
- `cic_harvest` - Query TorqueQuery for context
- `cic_redesign` - Architecture, refactoring
- `cic_outreach` - PR creation, code application
- `cic_delivery` - Summaries, artifacts
- `cic_audit` - Testing, self-healing

**Model Selection:**
| Task | Model | Effort | Why |
|------|-------|--------|-----|
| discover | GLM-5.1 | high | Fast classification |
| harvest | GLM-5.2 | high | Long-context extraction |
| redesign | GLM-5.2 | max | Architecture reasoning |
| outreach | GLM-5.1/5.2 | high | Code generation |
| delivery | GLM-5.1 | high | Summarization |
| audit | GLM-5.1 | high | Test validation |

**Output:**
- Edit Protocol (JSON)
- Refactor plans
- Code diffs
- PR summaries

---

### Labs Mode: External Redesign Business

**Task Types:**
- `labs_discovery` - Find candidate sites, score leads
- `labs_harvest` - Crawl sites, extract DOM/content/screenshots
- `labs_redesign` - Generate full-site redesign
- `labs_component_redesign` - Redesign individual components
- `labs_outreach` - Generate pitch emails
- `labs_lead_score` - Rapid lead qualification
- `labs_delivery` - Package redesign (code, assets, docs)

**Model Selection:**
| Task | Model | Effort | Why |
|------|-------|--------|-----|
| discovery | GLM-5.1 | high | Classification + scoring |
| harvest | GLM-5.2 | high | Long-context extraction |
| redesign | GLM-5.2 | max | Multi-page reasoning |
| component_redesign | GLM-5.2 | high | Design reasoning |
| outreach | GLM-5.1 | high | Email generation |
| lead_score | GLM-5.1 | high | Fast classification |
| delivery | GLM-5.2 | high | Code generation |

**Output:**
- Redesign Protocol (JSON)
- Site redesigns (components, tokens, layout)
- Lead scores
- Outreach emails
- Code and design assets

---

### Chat Mode: Interactive User Interface

**Task Types:**
- `chat_dom_edit` - Real-time DOM modifications
- `chat_design_variant` - Design system variants
- `chat_code_edit` - Single-file code edits
- `chat_refactor` - Multi-file refactoring
- `chat_search` - Contextual search

**Model Selection:**
| Task | Model | Effort | Why |
|------|-------|--------|-----|
| dom_edit | GLM-5.1 | high | Fast DOM edits |
| design_variant | GLM-5.2 | high | Design reasoning |
| code_edit | GLM-5.2 | high | Code generation |
| refactor | GLM-5.2 | high | Multi-file reasoning |
| search | GLM-5.1 | high | Fast retrieval |

**Output:**
- Edit Protocol (JSON)
- Immediate visual feedback

---

## Unified Context Frame

All modes receive a consistent context structure:

```typescript
interface UnifiedContextFrame {
  user_intent: string;          // What the user wants
  mode: "cic" | "labs" | "chat"; // Execution mode
  
  dom_context?: DOMContext;     // Chat/Labs DOM
  code_context?: CodeContext;   // CIC/Chat code
  design_context?: DesignContext; // Design tokens
  
  cic_context?: CICContext;     // Build/tests/PRs (CIC only)
  search_context?: SearchContext; // TorqueQuery results
  labs_context?: LabsContextFrame; // Site, lead (Labs only)
}
```

**Benefits:**
- Consistent GLM-5 input across modes
- Easy context sharing between modes
- Clear separation of mode-specific data

---

## Cross-Mode Integration

### CIC Calling Labs

CIC can request Labs for:

```typescript
// Generate design variants
const variants = await router.execute(
  "labs",
  { task_type: "labs_component_redesign", ... },
  context,
  prompt
);

// Get redesign inspiration
const redesign = await router.execute(
  "labs",
  { task_type: "labs_redesign", ... },
  context,
  prompt
);
```

### Labs Calling CIC

Labs can request CIC for:

```typescript
// Generate component library
const components = await router.execute(
  "cic",
  { task_type: "cic_redesign", ... },
  context,
  prompt
);

// Optimize assets
const optimized = await router.execute(
  "cic",
  { task_type: "cic_deliver", ... },
  context,
  prompt
);
```

### Both Calling Chat

Both modes can interact with Chat Engine:

```typescript
// Let user approve redesign before applying
const approved = await router.execute(
  "chat",
  { task_type: "chat_design_variant", ... },
  context,
  prompt
);
```

---

## Observability & Control

### Unified Telemetry

Every GLM-5 call logs:

```json
{
  "call_id": "call_123...",
  "timestamp": 1718658517000,
  "mode": "cic|labs|chat",
  "model": "glm-5.1|glm-5.2|glm-5",
  "task_type": "...",
  "reasoning_effort": "low|high|max",
  "context_size": 45000,
  "latency_ms": 2340,
  "tokens": { "input": 1200, "output": 450 },
  "success": true
}
```

**Metrics Possible:**
- Model distribution by mode
- Latency per task type
- Token usage per mode
- Failure rates by task/model
- Cost attribution (CIC vs Labs)

### Unified Guardrails

All modes enforce:

- **Temperature=0, Top_p=1** (deterministic by default)
- **enable_thinking=false** for user-facing edits
- **JSON validation** on all protocol outputs
- **Context limits** (GLM-5.1 ≤128k, GLM-5.2 ≤1M)
- **Fallback routing** (5.2 → 5.1 on failure)

### Unified Error Handling

1. **Invalid JSON** → Request correction, retry up to 2x
2. **Schema mismatch** → Log, escalate to user
3. **Context overflow** → Shrink context, retry with GLM-5.1
4. **Rate limiting** → Exponential backoff, queue request
5. **Timeout** → Fail fast, escalate

---

## Determinism & Reproducibility

### Version Control

All components are versioned:

```typescript
// Prompt packs
id: "cic_redesign_glm5_v1"
id: "labs_redesign_glm5_v1"

// Router config
version: "0.1.0"

// Edit protocols
version: "1.0.0"
```

### Reproducibility

Given identical input (prompt, model, parameters), GLM-5 produces identical JSON output.

- **Commit hash** → Always reproducible
- **Prompt pack version** → Trackable variations
- **Model version** → Expected behavior
- **Call logs** → Full audit trail

---

## Implementation Phases

### Phase 1: Core Infrastructure (Current)
- ✅ Type definitions (unified context, protocols)
- ✅ CICRouter (task classification + routing)
- ✅ UnifiedRouter (mode-based routing)
- ✅ GLM5Client (deterministic API wrapper)
- ✅ Prompt packs (CIC + Labs)

### Phase 2: TorqueQuery Integration
- Ingestion adapter (corpus → index)
- Query adapter (search → answer)
- Site extraction for Labs

### Phase 3: Chat Engine Integration
- ChatRequestEnvelope → Router flow
- DOM/code/design edit application
- Real-time preview updates

### Phase 4: CIC Orchestrator
- Multi-phase workflow engine
- Build/test integration
- PR creation and management

### Phase 5: Labs Orchestrator
- Site discovery and harvesting
- Lead scoring pipeline
- Outreach email generation
- Redesign delivery packaging

### Phase 6: Cross-Integration
- CIC ↔ Labs communication
- Unified observability dashboard
- Cost/ROI tracking
- A/B testing framework

---

## Success Criteria

- [ ] Router correctly classifies all task types in all modes
- [ ] Model selection matches routing rules
- [ ] GLM-5 outputs are valid JSON (100% compliance)
- [ ] Context frames assembled correctly
- [ ] Prompt packs render without errors
- [ ] Observability logs capture all metadata
- [ ] Fallback routing works (5.2 → 5.1)
- [ ] Cross-mode integration functional
- [ ] Determinism verified (seed tests)
- [ ] Latency < 30s for 99th percentile

---

## Design Decisions

### Why One Router for Three Modes?

**Unified Approach:**
- Single point of control for GLM-5 routing
- Consistent observability across modes
- Easier to add new modes later
- Simplified maintenance and updates
- Clear separation of concerns (mode selection → execution)

**Alternative:** Separate routers per mode
- Would require parallel infrastructure
- Hard to share TorqueQuery, observability, guardrails
- Inconsistent behavior across modes
- Duplication and maintenance burden

### Why Shared TorqueQuery?

Both CIC and Labs benefit from hybrid search:
- **CIC**: Find code patterns, dependencies, documentation
- **Labs**: Find design patterns, site components, competitor features

Same index structure, different content sources.

### Why Edit vs Redesign Protocols?

- **Edit Protocol**: Atomic, reversible changes (CIC/Chat)
  - DOM edit, code edit, refactor plan, answer
  - Minimal, focused outputs

- **Redesign Protocol**: Holistic, multi-component outputs (Labs)
  - Site redesign, component redesign, outreach, lead score
  - Larger scope, business context

### Why enable_thinking=false by Default?

- Faster response times (critical for Chat)
- Deterministic, reproducible outputs
- Easier validation and testing
- Users don't need internal reasoning explanations

Enable only when deep reasoning is critical (GLM-5.2, labs_redesign, cic_redesign).

---

## References

- [GLM-5 Integration Spec](GLM5_INTEGRATION.md)
- [Unified Edit Protocol](EDIT_PROTOCOL.md)
- [Service README](../services/glm5-router/README.md)
- [Rewrite Labs Redesign Protocol](LABS_REDESIGN_PROTOCOL.md)
