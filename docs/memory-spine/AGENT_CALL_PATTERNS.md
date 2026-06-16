# CIC Memory Spine — Agent Call Patterns

How CIC agents interact with the Memory Spine, including confidence gating and fallback logic.

---

## Standard query flow

### Step 1 — Agent receives task

The orchestrator assigns a task to an agent:

```
"Generate a repair plan for Node X."
```

### Step 2 — Agent decomposes into subtasks

The agent identifies knowledge gaps and forms a MemoryQuery:

```
Subtask: "What is the current CIC auto-repair engine spec?"
```

### Step 3 — Agent calls MemoryQuery

```json
POST /v1/memory/query
{
  "query_text": "What is the current CIC auto-repair engine spec?",
  "task_type": "repair",
  "domain": "cic-core",
  "time_hint": "2026-06-16T07:00:00Z",
  "max_tokens": 256
}
```

### Step 4 — Agent evaluates confidence

```
if response.confidence >= CONFIDENCE_THRESHOLD (default: 0.75):
    use response.answer_text directly in reasoning
else:
    trigger fallback (see below)
```

The memory answer is treated as **trusted tool output**, not prompt text. The agent does not re-verify it against the corpus unless confidence is low.

### Step 5 — Agent synthesizes final output

The agent incorporates the memory answer into its repair plan and returns to the orchestrator.

---

## Fallback flow (confidence < threshold)

When the Memory Spine returns low confidence:

```
1. Agent logs: { query, confidence, memory_version }
2. Agent calls TorqueQuery with provenance doc_ids as hints
3. If TorqueQuery returns results → use those
4. If TorqueQuery is unavailable → agent falls back to direct doc fetch
5. Agent notes in output: "Answer sourced from RAG fallback, not Memory Spine"
```

This keeps the Memory Spine as **primary** and RAG as **backup**, not the reverse.

---

## Multi-hop query pattern

For questions that span multiple CIC domains:

```json
// First call: get repair engine spec
POST /v1/memory/query
{ "query_text": "CIC auto-repair engine architecture", "domain": "cic-core" }

// Second call: get DLQ configuration for that engine
POST /v1/memory/query
{ "query_text": "DLQ pruning configuration for repair engine", "domain": "infra" }

// Agent synthesizes both answers before generating the repair plan
```

The Spine handles each query independently. Cross-document synthesis is the agent's responsibility.

---

## Memory edit pattern (agent-initiated)

When an agent discovers that a document is outdated:

```json
POST /v1/memory/edit
{
  "operation": "update",
  "doc_id": "adr-42",
  "payload": {
    "title": "CIC Auto-Repair Engine v2",
    "content": "Updated architecture including new DLQ pruning logic."
  }
}
```

The orchestrator controls which agents have edit permission. By default, only privileged agents (e.g., `doc-sync-agent`) can call MemoryEdit.

---

## Orchestrator configuration

Add to CIC Orchestrator config:

```json
{
  "memory_spine": {
    "url": "http://memory-spine:3100",
    "active_memory_model": "memory-v3",
    "confidence_threshold": 0.75,
    "domain_routing": {
      "build":   "cic-core",
      "repair":  "cic-core",
      "roadmap": "roadmap",
      "skills":  "skills",
      "infra":   "infra"
    },
    "fallback": "torque-query"
  }
}
```

---

## MCP tool call pattern

When the Spine is exposed via MCP, agents call it as a registered tool:

```json
{
  "type": "tool_use",
  "name": "memory_query",
  "input": {
    "query_text": "What is the CIC auto-repair engine spec?",
    "task_type": "repair",
    "domain": "cic-core",
    "max_tokens": 256
  }
}
```

The MCP server wraps the HTTP endpoint and returns the same response shape. Confidence gating is handled by the orchestrator, not the MCP layer.
