# CIC Phase 26 Agent Grounding — Post-Merge Enablement Checklist

**Objective:** After PR #37 merges, enable all CIC agents to query code deterministically.

**Timeline:** 2-3 days, parallelizable.

**Owner:** Agent team (this checklist).

---

## Pre-Merge Verification (Day 0)

- [ ] PR #37 is merged to main
- [ ] All 7 commits are in main:
  - 96edbb4 (Typesense Indexer)
  - 7b6d5f0 (Dev Integration Layer)
  - 6da4345 (TorqueQuery Dev Stack)
  - 0edad37 (TorqueQuery Phase 26)
  - 34c6847 (Agent Tooling)
  - c606b90 (CIC Architecture)
  - 17f26a8 (Delivery Summary)
- [ ] No conflicts in chat-agent/src/

---

## Phase 1: Start Indexer (Day 1 Morning)

**Goal:** Get the indexer running and ingesting code.

### 1.1 Start Typesense

```bash
# In docker-compose.yml, ensure:
services:
  typesense:
    image: typesense/typesense:latest
    ports:
      - "8108:8108"
    environment:
      TYPESENSE_API_KEY: dev-key
```

```bash
docker-compose up typesense
# Verify: curl http://localhost:8108/health
```

**Expected:** `{"ok":true}`

- [ ] Typesense is running on :8108

### 1.2 Start Indexer

```bash
cd typesense-indexer
npm install
npm run dev
```

**Expected:** Logs showing file watcher active, files being indexed.

```
2026-06-21T12:00:00Z - Watcher started for repo: castironforge root: /path/to/castironforge
2026-06-21T12:00:01Z - ADD src/agents/warmPoolAgent.ts
2026-06-21T12:00:02Z - ✓ Indexed: castironforge/src/agents/warmPoolAgent.ts
```

- [ ] Indexer is running and logging file changes
- [ ] Check Typesense has documents: `curl "http://localhost:8108/collections/code_files/documents/search?q=*"`

---

## Phase 2: Wire TorqueQuery (Day 1 Afternoon)

**Goal:** Connect the indexer output to TorqueQuery via the API gateway.

### 2.1 Start Search API

```bash
cd search-api
npm install
npm run dev
```

**Expected:** Server on :5050

```bash
curl "http://localhost:5050/search?q=WarmPoolManager"
# Should return indexed results from Typesense
```

- [ ] Search API is running on :5050
- [ ] Search API queries return code files

### 2.2 Start Embedding Engine

```bash
cd torquequery-embeddings
npm install
npm run dev
```

**Expected:** Server on :5053, deterministic embeddings available

```bash
curl -X POST http://localhost:5053/embed \
  -H "Content-Type: application/json" \
  -d '{"text": "WarmPoolManager"}'
# Returns deterministic vector for "WarmPoolManager"
```

- [ ] Embedding Engine is running on :5053
- [ ] Embeddings are deterministic (same query = same vector)

### 2.3 Start API Gateway

```bash
cd torquequery-gateway
npm install
npm run dev
```

**Expected:** Unified API on :5051

```bash
# Test all three modes
curl "http://localhost:5051/keyword?q=WarmPoolManager"
curl "http://localhost:5051/semantic?q=how+does+hydration+work"
curl "http://localhost:5051/hybrid?q=WarmPoolManager"
# All should return results
```

- [ ] API Gateway is running on :5051
- [ ] `/hybrid` endpoint returns merged results from Typesense + embeddings
- [ ] `/keyword` returns Typesense results only
- [ ] `/semantic` returns embedding-based results

### 2.4 Verify TorqueQuery Integration

```bash
# Query should come from indexer → Typesense → Search API → Gateway
curl "http://localhost:5051/hybrid?q=spawn" | jq '.results[0]'
```

**Expected:**
```json
{
  "path": "src/agents/WarmPoolManager.ts",
  "repo": "castironforge",
  "symbols": ["WarmPoolManager", "spawn", ...],
  "hybridScore": 0.892
}
```

- [ ] Full pipeline works: Indexer → Typesense → Gateway

---

## Phase 3: Enable Agent Tools (Day 1 Evening / Day 2 Morning)

**Goal:** Wire the tool registry into chat-agent initialization.

### 3.1 Verify Tool Registry

Check that `chat-agent/src/tools/registry.ts` exists and exports:

```typescript
export const tools = {
  code_search: codeSearch,
  torque_query: torqueQuerySearch
};

export async function callTool(name: ToolName, query: string, options?: Record<string, unknown>) {
  // routes to appropriate tool
}
```

- [ ] `chat-agent/src/tools/registry.ts` exists
- [ ] Exports `tools`, `callTool`, `toolSchemas`, `getToolSchema`

### 3.2 Integrate into Agent Initialization

In `chat-agent/src/server.ts` or agent setup:

```typescript
import { tools, toolSchemas } from "./tools/registry.js";

// When initializing agents, register all tools
const agentTools = toolSchemas.map(schema => ({
  name: schema.name,
  description: schema.description,
  parameters: schema.parameters
}));

// Make tools available to all agents
const agentContext = {
  tools,
  toolSchemas: agentTools
};
```

- [ ] Tool registry is imported in agent initialization
- [ ] All agents have access to `code_search` and `torque_query` tools

### 3.3 Test Tool Calling

Create a test script `chat-agent/test-grounding.ts`:

```typescript
import { callTool } from "./tools/registry.js";

async function testAgentGrounding() {
  // Test code_search tool
  const codeHits = await callTool("code_search", "WarmPoolManager", {
    queryBy: "symbols"
  });
  console.log("Code search found:", codeHits.length, "results");

  // Test torque_query tool
  const torqueHits = await callTool("torque_query", "WarmPoolManager", {
    mode: "hybrid"
  });
  console.log("TorqueQuery found:", torqueHits.length, "results");

  return { codeHits, torqueHits };
}

testAgentGrounding().catch(console.error);
```

```bash
cd chat-agent
npx ts-node test-grounding.ts
```

**Expected:**
```
Code search found: 3 results
TorqueQuery found: 3 results
```

- [ ] Both tools are callable from agents
- [ ] Both return grounded results

---

## Phase 4: Create Agent Grounding Pattern (Day 2)

**Goal:** Document the pattern for any agent to use code search.

### 4.1 Create Agent Template

File: `chat-agent/src/agents/AGENT_TEMPLATE.ts`

```typescript
import { callTool, ToolName } from "../tools/registry.js";

export interface AgentQuery {
  action: string;
  query?: string;
  // ...
}

export interface AgentResponse {
  grounded: boolean;
  file?: string;
  repo?: string;
  explanation?: string;
  error?: string;
}

export async function myAgentHandle(query: AgentQuery): Promise<AgentResponse> {
  try {
    // STEP 1: Query for facts
    const hits = await callTool("torque_query", query.query || "", {
      mode: "hybrid"
    });

    // STEP 2: Check if grounded
    if (hits.length === 0) {
      return {
        grounded: false,
        error: `No results found for: ${query.query}`
      };
    }

    // STEP 3: Use results
    const top = hits[0];
    return {
      grounded: true,
      file: top.path,
      repo: top.repo,
      explanation: `Found in ${top.path}: ${top.content.substring(0, 300)}...`
    };
  } catch (err) {
    return {
      grounded: false,
      error: String(err)
    };
  }
}
```

- [ ] Template created at `chat-agent/src/agents/AGENT_TEMPLATE.ts`
- [ ] Template demonstrates 3-step pattern: Query → Check → Use

### 4.2 Update Existing Agents

For each agent in `chat-agent/src/agents/`:

1. Add import:
```typescript
import { callTool } from "../tools/registry.js";
```

2. Before answering, query for facts:
```typescript
const hits = await callTool("torque_query", userQuery);
if (hits.length === 0) {
  return { grounded: false, error: "Not found" };
}
```

3. Use results:
```typescript
const file = hits[0];
return { grounded: true, file: file.path };
```

**Agents to update:**
- [ ] warmPoolAgent.ts
- [ ] adapterAgent.ts
- [ ] [any others]

### 4.3 Verify Grounding

Test each agent:

```bash
# Test WarmPoolManager agent
npm run test -- warmPoolAgent

# Test Adapter agent
npm run test -- adapterAgent
```

**Expected:** All agents return `grounded: true` with real file paths.

- [ ] All agents have code search integration
- [ ] All return grounded: true/false appropriately

---

## Phase 5: Documentation (Day 2 Afternoon)

**Goal:** Make it obvious to future developers how to use code search.

### 5.1 Add to Agent Development Guide

File: `docs/AGENT_DEVELOPMENT.md` (create or update)

```markdown
# Agent Development Guide

## Grounding Your Agent in Code

Every agent should query for facts before answering. Use the code search tools:

### Quick Start

```typescript
import { callTool } from "../tools/registry.js";

// Query for code
const hits = await callTool("torque_query", "WarmPoolManager");

// Check if grounded
if (hits.length === 0) {
  return { grounded: false };
}

// Use results
return {
  grounded: true,
  file: hits[0].path,
  explanation: `Found in ${hits[0].path}`
};
```

### Tools Available

- `code_search` — Typesense keyword search (fast, structure-focused)
- `torque_query` — Hybrid keyword + semantic (default)

See [AGENT_TOOLING_GUIDE.md](../AGENT_TOOLING_GUIDE.md) for full API.
```

- [ ] Agent development guide created or updated
- [ ] Includes code search integration pattern
- [ ] Links to AGENT_TOOLING_GUIDE.md

### 5.2 Add Migration Notes

File: `docs/PHASE_26_RELEASE_NOTES.md`

```markdown
# CIC Phase 26 Release Notes

## Code Search Infrastructure (NEW)

CIC now includes deterministic, multi-repo code search via TorqueQuery.

### What's New

- **Typesense Indexer** — watches files, extracts metadata, indexes code
- **Hybrid Search** — combines keyword + semantic for balanced retrieval
- **Agent Grounding** — agents can query code deterministically
- **Zero Hallucinations** — all agent answers backed by verified code

### For Agents

All agents now have access to:

```typescript
import { callTool } from "./tools/registry.js";
const hits = await callTool("torque_query", "symbol_name");
```

### Getting Started

1. Start the indexer: `cd typesense-indexer && npm run dev`
2. Start the API gateway: `cd torquequery-gateway && npm run dev`
3. Query from agents: `callTool("torque_query", query)`

### Performance

- Keyword search: 5-15ms
- Semantic search: 50-80ms
- Hybrid: 100-120ms

See [TORQUEQUERY_PHASE26.md](../TORQUEQUERY_PHASE26.md) for complete documentation.
```

- [ ] Migration notes created
- [ ] Explains what's new and how to use it
- [ ] Includes quick start for agents

---

## Phase 6: Validation (Day 2 Evening)

**Goal:** Ensure everything works end-to-end.

### 6.1 Full Stack Test

```bash
# Terminal 1
cd typesense-indexer && npm run dev

# Terminal 2
cd search-api && npm run dev

# Terminal 3
cd torquequery-embeddings && npm run dev

# Terminal 4
cd torquequery-gateway && npm run dev

# Terminal 5: Run test
cd chat-agent
npx ts-node test-grounding.ts
```

**Expected:**
```
Code search found: 3 results
TorqueQuery found: 3 results
```

- [ ] All services running
- [ ] Test script passes
- [ ] Logs show no errors

### 6.2 Agent Integration Test

```bash
# Test an actual agent
npm run test -- warmPoolAgent

# Output should show:
# {
#   grounded: true,
#   file: "src/agents/WarmPoolManager.ts",
#   repo: "castironforge"
# }
```

- [ ] Agents are calling code search
- [ ] Agents return grounded: true
- [ ] Real file paths are returned

### 6.3 Performance Benchmark

```bash
# Measure query latency
time curl "http://localhost:5051/hybrid?q=WarmPoolManager"
time curl "http://localhost:5051/keyword?q=spawn"
time curl "http://localhost:5051/semantic?q=how+does+hydration+work"
```

**Expected:**
- Keyword: <20ms
- Semantic: <100ms
- Hybrid: <150ms

- [ ] Keyword queries < 20ms
- [ ] Semantic queries < 100ms
- [ ] Hybrid queries < 150ms

---

## Final Checklist (Day 3)

- [ ] Indexer is running and ingesting files
- [ ] Typesense has code_files collection with >100 documents
- [ ] Search API returns results for queries
- [ ] Embedding Engine produces deterministic vectors
- [ ] API Gateway routes to all backends
- [ ] Tool registry is integrated into chat-agent
- [ ] All agents have code search integration
- [ ] Agents return grounded: true/false appropriately
- [ ] Documentation is updated (guide + release notes)
- [ ] Performance targets are met
- [ ] No errors in logs

---

## Rollback Plan

If anything breaks:

1. **Indexer issues:** Stop indexer, delete Typesense collection, restart
2. **Search API issues:** Check Typesense connection, restart service
3. **Gateway issues:** Check all backend services are running
4. **Agent issues:** Check tool registry imports, verify tool schemas
5. **Full reset:** `docker-compose down && docker-compose up` + restart all services

---

## Success Criteria

✅ **Agent Grounding Enabled**
- Agents can query code deterministically
- Agents return grounded: true with real file paths
- No hallucinations (all answers backed by code)

✅ **Performance Met**
- Queries complete in <150ms
- Agents can call multiple times without latency issues

✅ **Documentation Complete**
- Developers know how to use code search
- Migration notes explain what's new

✅ **Ready for Phase 27**
- Query Planner can build on this
- Caching layer is pluggable
- Distributed mode prep can begin

---

**Status after checklist completion:** 🚀 Agent Grounding Tier 1 COMPLETE

**Next:** Phase 4 (Week 2) — Observability Dashboard

