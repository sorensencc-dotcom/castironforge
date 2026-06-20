# OpenSharing × Omnigent × DBRX Integration Design for CIC Phase 26

**Date:** 2026-06-20  
**Status:** Research & Architecture Planning  
**Author:** Claude Code  
**Target:** CIC Phase 26 (TorqueQuery, Orchestrator, Multi-Agent Patterns)

---

## Executive Summary

OpenSharing, Omnigent, and Databricks DBRX form a coherent ecosystem that naturally extends CIC's multi-runtime, operator-grade architecture. This document maps integration points, design patterns, and Phase 26 roadmap alignment.

**Key Insight:** OpenSharing is the missing interoperability layer for multi-agent model/skill sharing. Omnigent is a reference architecture for orchestration. DBRX is an alternative inference backbone.

---

## 1. Current CIC Architecture

### 1.1 Runtime Layer

CIC abstracts inference backends via `RuntimeAdapter`:

```typescript
interface RuntimeAdapter {
  health(): Promise<HealthStatus>;
  models(): Promise<RuntimeModel[]>;
  complete(params: CompleteParams): Promise<string>;
  stream(params: StreamParams): Promise<void>;
  embed(text: string): Promise<number[]>;
}
```

**Current Runtimes:**
- `local:*` → Ollama (local LLM)
- `cpu:*` → llama.cpp (CPU inference)
- `torque:*` → TorqueQuery (RAG + search)

**Model Resolution:** Simple prefix matching in `resolveRuntime()`.

### 1.2 Request Flow

```
Browser (chat-frontend :5173)
  ↓ fetch / EventSource
chat-agent :8000
  ├─ resolveRuntime(model prefix) → RuntimeAdapter
  ├─ rag.search() → TorqueQuery :9000
  └─ runtime.stream() / runtime.complete()
       └─ inference backend
```

### 1.3 Observations

✓ **Strengths:**
- Clean adapter pattern; easy to add new runtimes
- Prefix-based routing is lightweight and operator-friendly
- RAG integration is non-blocking (`.catch(() => [])`)
- SSE streaming contract is simple

✗ **Gaps for Phase 26:**
- No agent skill sharing or discovery
- No credential vending for external model/data access
- No multi-agent orchestration (supervisor → sub-agents)
- No policy enforcement (spend caps, tool allowlists)
- Model prefix logic is hardcoded

---

## 2. OpenSharing Integration

### 2.1 What OpenSharing Adds

OpenSharing (Linux Foundation AI & Data) is a vendor-neutral standard for sharing:

| Asset Type | Use Case | CIC Application |
|-----------|----------|-----------------|
| **Table** | Delta/Iceberg/Parquet datasets | RAG indexing source |
| **Volume** | Arbitrary files (models, embeddings, HTML) | Model weights, training data |
| **Model** | Versioned ML artifacts | Published CIC-trained models |
| **AgentSkill** | Reusable agent capabilities | CIC Harvester skills |
| **Agent** (proposed) | Callable agent services | CIC sub-agents |
| **Page** (proposed) | Semantic knowledge units | CIC knowledge base |

### 2.2 Zero-Copy Credential Vending

**The killer feature for CIC:**

```
CIC wants to consume a shared Table from Rewrite Labs
  ↓
OpenSharing Server vends temporary scoped credentials
  (AWS STS token, Azure SAS, GCP OAuth, R2 presigned URL)
  ↓
CIC TorqueQuery reads directly from provider storage
  ↓
No data leaves provider, no ETL required, zero-copy
```

This maps perfectly to:
- `Harvester → TorqueQuery` (consume external datasets)
- `CIC → Rewrite Labs` (publish enriched models)
- `CIC → Multi-agent ecosystem` (share trained skills)

### 2.3 Integration Points

#### 2.3.1 Add `opensharing` RuntimeAdapter

```typescript
// chat-agent/src/runtimes/opensharing.ts
interface OpenSharingConfig {
  serverUrl: string;
  principalId: string;
  shareNamespace: string;
}

export const opensharingAdapter: RuntimeAdapter = {
  async health() {
    // Check OpenSharing server health
  },
  
  async models() {
    // List Model assets from OpenSharing
    // Returns models with temporary credential URLs
  },
  
  async complete(params) {
    // Download model weights via OpenSharing credentials
    // Run inference locally or via OpenSharing Model Serving
  },
  
  async stream(params) { /* ... */ },
  async embed(text) { /* ... */ }
}
```

**Prefix:** `sharing:*` (e.g., `sharing:dbrx-instruct-v0.1`)

#### 2.3.2 Extend RuntimeModel Type

```typescript
interface RuntimeModel {
  id: string;
  name: string;
  runtime: 'ollama' | 'llamacpp' | 'torque' | 'opensharing';
  size?: string;
  
  // OpenSharing-specific
  shareNamespace?: string;
  assetVersion?: string;
  credentialsExpiryTime?: number;
  accessPolicy?: 'read' | 'readwrite';
}
```

#### 2.3.3 Dynamic Model Discovery

Replace hardcoded prefix matching with dynamic registry:

```typescript
// chat-agent/src/runtimes/registry.ts
interface RuntimeRegistry {
  list(): Promise<RuntimeModel[]>;
  resolve(modelId: string): RuntimeAdapter;
  register(prefix: string, adapter: RuntimeAdapter): void;
}

// At startup, fetch from OpenSharing, Ollama, llama.cpp
// Merge results into unified model list
```

### 2.4 RAG + OpenSharing Volumes

CIC can index shared volumes without copying data:

```typescript
// rag.ts enhancement
async function searchSharedVolume(
  query: string,
  volumeRef: OpenSharingVolumeRef
): Promise<Document[]> {
  const credentials = await opensharingServer.getCredentials(volumeRef);
  // Stream from S3/Azure/GCS directly into TorqueQuery
  // No intermediate storage
}
```

### 2.5 Operator Experience

**From CIC operator perspective:**

```bash
# Before: hardcoded runtimes
curl -X POST localhost:8000/chat \
  -d '{"model": "local:qwen", "message": "..."}'

# After: OpenSharing-aware discovery
curl -X GET localhost:8000/models
# Returns: [
#   {id: "local:qwen", runtime: "ollama"},
#   {id: "cpu:phi", runtime: "llamacpp"},
#   {id: "sharing:dbrx-instruct-v0.1", runtime: "opensharing"},
#   {id: "sharing:cic-harvester-v2", runtime: "opensharing"}
# ]

curl -X POST localhost:8000/chat \
  -d '{"model": "sharing:dbrx-instruct-v0.1", "message": "..."}'
```

---

## 3. Omnigent Integration (Reference Patterns)

### 3.1 What Omnigent Provides

Omnigent is an open-source meta-harness for orchestrating multiple agent runtimes:

| Capability | CIC Analog | Integration Strategy |
|-----------|-----------|---------------------|
| **Multi-agent routing** | Supervisor → coding sub-agents | Adopt pattern, keep deterministic |
| **Policy enforcement** | Spend caps, tool allowlists | Implement as middleware |
| **Real-time collaboration** | Multi-user chat sessions | Optional; separate concern |
| **Gateway support** | OpenRouter, Ollama, vLLM | Extend `RuntimeRegistry` |
| **Cloud sandboxing** | Modal, Daytona execution | Keep local; optional enterprise layer |
| **Model integration** | Databricks, Copilot, Claude | Use unified adapter pattern |

### 3.2 Supervisor Agent Pattern

**Omnigent's key insight:** Agents can be orchestrated hierarchically.

```
┌─────────────────────────────┐
│  Supervisor Agent (Claude)  │
│  Routes & monitors          │
└────────────┬────────────────┘
             │
    ┌────────┼────────┐
    ↓        ↓        ↓
┌────────┐┌────────┐┌──────────┐
│ Coder  ││Reviewer││Evaluator │
│ Agent  ││ Agent  ││ Agent    │
└────────┘└────────┘└──────────┘
```

**For CIC Phase 26:**

```
┌──────────────────────────────┐
│  CIC Orchestrator            │
│  (Multi-agent coordinator)   │
└────────┬─────────────────────┘
         │
  ┌──────┼──────┬──────────┐
  ↓      ↓      ↓          ↓
┌──────────────┐ ┌────────────────┐
│ Harvester    │ │ Enricher       │
│ (Scraper)    │ │ (Inference)    │
└──────────────┘ └────────────────┘
     ↓                   ↓
  Data sources      TorqueQuery index
```

### 3.3 Policy Enforcement Middleware

Omnigent enforces policies at the agent level:

```typescript
// chat-agent/src/middleware/policyGate.ts
interface PolicyConfig {
  maxTokensPerSession: number;
  allowedModels: string[];
  maxConcurrentRequests: number;
  ratelimitPerMinute: number;
}

export const policyGate = (policy: PolicyConfig) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const { model, sessionId } = req.body;
    
    // Check: is model allowed?
    if (!policy.allowedModels.includes(model)) {
      return res.status(403).json({ error: 'Model not allowed' });
    }
    
    // Check: have we exceeded token budget for this session?
    const spent = await getSessionTokens(sessionId);
    if (spent > policy.maxTokensPerSession) {
      return res.status(429).json({ error: 'Token budget exhausted' });
    }
    
    next();
  };
};
```

**Operator workflow:**

```bash
# CLAUDE.md or settings.json
[policy]
maxTokensPerSession = 1000000
allowedModels = ["local:qwen", "sharing:dbrx-instruct"]
maxConcurrentRequests = 5
ratelimitPerMinute = 60
```

### 3.4 What to Adopt vs. Skip

**Adopt:**
- ✓ Hierarchical agent routing (Orchestrator → Harvester, Enricher)
- ✓ Policy enforcement middleware (spend caps, allowlists)
- ✓ Gateway abstraction (OpenRouter, Ollama, vLLM via adapters)
- ✓ Cloud sandbox integration (future: Modal for distributed Harvester)

**Skip (CIC has different philosophy):**
- ✗ UI-driven agent chaining (CIC is deterministic, operator-grade)
- ✗ Real-time collaboration (out of scope)
- ✗ Non-deterministic supervisor routing (CIC uses explicit Orchestrator)

---

## 4. DBRX Integration

### 4.1 What DBRX Provides

Databricks DBRX is a family of open LLMs optimized for enterprise:

**Available Models:**
- `dbrx-instruct` — instruction-tuned, chat
- `dbrx-base` — base, completion
- Open weights (Apache 2.0 license)
- Up to 132B parameters

**Performance:**
- Competitive with Claude 3.5 Sonnet on many benchmarks
- Optimized for function-calling, long context
- Open weights = can be fine-tuned for domain tasks

**Deployment Options:**
1. Download weights, run locally via llama.cpp
2. Serve via Databricks Model Serving (enterprise)
3. Share via OpenSharing Model assets
4. Consume via OpenRouter API (third-party)

### 4.2 Integration Strategy

#### Option A: Local Weights (llama.cpp)

```bash
# Operator downloads GGUF quantization
wget https://huggingface.co/…/dbrx-instruct.gguf

# Runs via existing llama.cpp adapter
# Exposes as cpu:dbrx-instruct

# No code changes needed; just add model
```

**Pros:** Zero-copy, operator controls execution  
**Cons:** Requires manual weight management

#### Option B: OpenSharing Model Asset

```typescript
// OpenSharing publishes DBRX as a shared Model asset
// CIC fetches via opensharing adapter

const model = "sharing:dbrx-instruct-v1";
// opensharingAdapter.models() discovers it automatically
// opensharingAdapter.complete() uses temporary credentials
```

**Pros:** Automatic discovery, credential vending, version management  
**Cons:** Requires OpenSharing infrastructure

#### Option C: Databricks Model Serving (Enterprise)

```typescript
// CIC adds databricks runtime adapter
// Routes to https://api.databricks.com/serving-endpoints/dbrx-instruct

export const databricksAdapter: RuntimeAdapter = {
  async complete({ model, message }) {
    const res = await fetch('https://api.databricks.com/v1/endpoints/…/invocations', {
      headers: { Authorization: `Bearer ${process.env.DATABRICKS_TOKEN}` },
      body: JSON.stringify({ messages: [{ role: 'user', content: message }] })
    });
    const data = await res.json();
    return data.choices[0].message.content;
  }
}
```

**Prefix:** `databricks:*` (e.g., `databricks:dbrx-instruct`)

### 4.3 Why DBRX for CIC Phase 26

| Criterion | Why DBRX | Alignment |
|-----------|----------|-----------|
| **Open weights** | Can be fine-tuned on domain data (Harvester output) | Multi-agent enrichment |
| **Long context** | 32k tokens; suitable for RAG-augmented prompts | TorqueQuery + Orchestrator |
| **Function calling** | Natural for agent tool use | Harvester skills |
| **Non-proprietary** | Databricks license; can be shared via OpenSharing | Ecosystem interop |
| **Enterprise-grade** | Deployed in production; benchmarks available | Operator confidence |

---

## 5. Phase 26 Roadmap Integration

### 5.1 Current Architecture (Phase 25)

```
browser ←→ chat-agent ←→ {ollama, llama.cpp, torque}
              │
              └─ rag.search() → TorqueQuery
```

### 5.2 Phase 26 Target: Multi-Agent Orchestrator

```
┌─────────────────────────────────────────┐
│  CIC Orchestrator (Supervisor)          │
│  • Policy enforcement                   │
│  • Multi-agent routing                  │
│  • Session state management             │
└────────┬──────────────────────┬─────────┘
         │                      │
         ↓                      ↓
    ┌──────────────┐     ┌──────────────────┐
    │  Harvester   │     │  Enricher        │
    │  (Scraper)   │     │  (Inference)     │
    └──────┬───────┘     └────────┬─────────┘
           │                      │
      Data sources          ┌─────┴──────────┐
                            ↓                ↓
                      ┌──────────┐    ┌──────────────┐
                      │ Runtime  │    │ OpenSharing  │
                      │ Registry │    │ (Models,     │
                      │          │    │  Skills)     │
                      └────┬─────┘    └──────────────┘
                           │
          ┌────────────────┼────────────────┐
          ↓                ↓                ↓
      ┌────────┐      ┌─────────┐     ┌──────────┐
      │Ollama  │      │llama.cpp│     │Databricks│
      │(local) │      │(cpu)    │     │(cloud)   │
      └────────┘      └─────────┘     └──────────┘
```

### 5.3 Implementation Roadmap

#### Phase 26a: Runtime Registry & Dynamic Model Discovery

**Files to modify:**
- `chat-agent/src/runtimes/registry.ts` (new)
- `chat-agent/src/router/chatAgentRouter.ts` (use registry instead of hardcoded logic)

**Outcome:** Operators can add/remove runtimes without code changes.

#### Phase 26b: OpenSharing Runtime Adapter

**Files:**
- `chat-agent/src/runtimes/opensharing.ts` (new)
- `chat-agent/src/runtimes/config.ts` (add OPENSHARING_URL)

**Outcome:** CIC can discover & consume shared models, tables, volumes.

#### Phase 26c: Policy Enforcement Middleware

**Files:**
- `chat-agent/src/middleware/policyGate.ts` (new)
- `CLAUDE.md` or `settings.json` (policy config)

**Outcome:** Operators define spend caps, model allowlists, rate limits.

#### Phase 26d: DBRX Integration

**Choose one:**
- **Option A:** Add DBRX GGUF to llama.cpp (zero code change)
- **Option B:** Implement `databricks` runtime adapter (if using Databricks enterprise)
- **Option C:** Publish DBRX via OpenSharing, consume via `opensharing` adapter

#### Phase 26e: Omnigent-Inspired Agent Orchestration

**Files:**
- `chat-agent/src/orchestrator/` (new directory)
- `chat-agent/src/orchestrator/supervisor.ts` (coordinator logic)

**Outcome:** Support for sub-agents (Harvester, Enricher) coordinated by Orchestrator.

---

## 6. Operator Experience (Phase 26)

### 6.1 Model Discovery

```bash
# Before
curl -X GET localhost:8000/models
# Response: [
#   {id: "local:qwen", runtime: "ollama"},
#   {id: "cpu:phi", runtime: "llamacpp"}
# ]

# After (with OpenSharing, DBRX, Databricks)
curl -X GET localhost:8000/models
# Response: [
#   {id: "local:qwen", runtime: "ollama"},
#   {id: "cpu:phi", runtime: "llamacpp"},
#   {id: "sharing:dbrx-instruct", runtime: "opensharing"},
#   {id: "sharing:cic-harvester-v2", runtime: "opensharing"},
#   {id: "databricks:dbrx-base", runtime: "databricks"}
# ]
```

### 6.2 Configuration

```yaml
# CLAUDE.md or settings.json
[orchestrator]
# Registry configuration
runtimes = ["ollama", "llamacpp", "opensharing", "databricks"]

# OpenSharing
[opensharing]
serverUrl = "https://opensharing.example.com"
principalId = "cic-phase26"
namespace = "rewrite-labs"

# Databricks (optional)
[databricks]
workspaceUrl = "https://workspace.databricks.com"
token = "${DATABRICKS_TOKEN}"
endpointName = "dbrx-instruct"

# Policy enforcement
[policy]
maxTokensPerSession = 10_000_000
allowedModels = ["local:*", "cpu:*", "sharing:*"]
maxConcurrentRequests = 10
ratelimitPerMinute = 120
```

### 6.3 Multi-Agent Orchestration

```typescript
// Orchestrator coordinates sub-agents
const harvestTask = {
  agent: "harvester",
  source: "https://docs.example.com",
  target: "opensharing:tables/harvester-output"
};

const enrichTask = {
  agent: "enricher",
  input: "opensharing:tables/harvester-output",
  model: "sharing:dbrx-instruct",
  target: "opensharing:models/cic-enriched-v1"
};

// Supervisor orchestrates
await orchestrator.execute([harvestTask, enrichTask]);
```

---

## 7. Design Principles

### 7.1 Operator-Grade Architecture

- ✓ Explicit routing (no black-box scheduler)
- ✓ Transparent configuration (no hidden state)
- ✓ Observable behavior (health checks, logs)
- ✓ Operator control (manual approval for shared assets)

### 7.2 Zero-Copy Data Movement

- ✓ Credentials vended by OpenSharing, not data
- ✓ Direct access from provider storage
- ✓ No intermediate ETL pipelines

### 7.3 Interoperability

- ✓ Open standards (OpenSharing, DBRX weights)
- ✓ Vendor-neutral adapters
- ✓ Multi-model environment

### 7.4 Deterministic Execution

- ✓ Supervisor explicitly delegates to sub-agents
- ✓ No implicit routing or auto-scaling
- ✓ CIC operator is always in control

---

## 8. Migration Path from Current CIC

| Phase | Work | Outcome |
|-------|------|---------|
| **25** (current) | `local:`, `cpu:`, `torque:` runtimes | Single-runtime model selection |
| **26a** | Add Runtime Registry | Dynamic model discovery |
| **26b** | Add OpenSharing adapter | Shared model/skill consumption |
| **26c** | Add policy enforcement | Spend caps, allowlists |
| **26d** | Integrate DBRX (Option A/B/C) | Enterprise-grade inference choice |
| **26e** | Implement Orchestrator | Multi-agent coordination |

**Backward compatibility:** All Phase 25 functionality remains unchanged; new features are additive.

---

## 9. Risk & Mitigation

| Risk | Mitigation |
|------|-----------|
| OpenSharing credential expiry | Refresh on-demand; retry with fresh credentials |
| Network latency (cloud models) | Cache model weights locally; fallback to local runtimes |
| Operator configuration error | Validate policy config at startup; warn on mismatches |
| Multi-agent deadlock | Explicit timeout + circuit breaker per sub-agent |
| DBRX model quality drift | Version models explicitly; pin to known-good versions |

---

## 10. Next Steps

1. **Review & feedback** on design principles
2. **Prototype Phase 26a** (Runtime Registry)
3. **Implement Phase 26b** (OpenSharing adapter) — coordinate with OpenSharing team
4. **Evaluate DBRX** (See separate Model Evaluation document)
5. **Design Orchestrator** (Phase 26e) once 26a–26d are stable

---

## References

- **OpenSharing Spec:** https://github.com/linear-foundation/opensharing
- **Omnigent Repo:** https://github.com/omnigent/omnigent
- **Databricks DBRX:** https://www.databricks.com/blog/introducing-dbrx
- **CIC CLAUDE.md:** /home/user/castironforge/CLAUDE.md
- **CIC Runtime Types:** /home/user/castironforge/chat-agent/src/runtimes/types.ts
