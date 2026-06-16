# CIC Memory Spine — Orchestrator Integration Patch

How to wire the Memory Spine into the CIC Orchestrator.

---

## Orchestrator config addition

Add the `memory_spine` block to the CIC Orchestrator configuration:

```json
{
  "memory_spine": {
    "url": "http://memory-spine:3100",
    "active_memory_model": "memory-v1",
    "confidence_threshold": 0.75,
    "domain_routing": {
      "build":   "cic-core",
      "repair":  "cic-core",
      "plan":    "roadmap",
      "inspect": "cic-core",
      "skills":  "skills",
      "infra":   "infra"
    },
    "fallback": "torque-query",
    "timeout_ms": 2000
  }
}
```

---

## Routing logic (pseudo-code)

```
function routeKnowledgeQuery(query, task_type, domain):
    // 1. Try Memory Spine first
    result = memorySpine.query({
        query_text: query,
        task_type: task_type,
        domain: config.domain_routing[task_type] ?? domain,
        time_hint: now(),
        max_tokens: 256
    })

    // 2. Gate on confidence
    if result.confidence >= config.confidence_threshold:
        return { source: "memory-spine", answer: result.answer_text, provenance: result.provenance }

    // 3. Fallback
    log.warn("Memory Spine low confidence", { confidence: result.confidence, query })
    return fallback.query(query, domain)
```

---

## MCP registration (drop-in)

Register the Memory Spine MCP server in the orchestrator's MCP client config:

```json
{
  "mcpServers": {
    "cic-memory-spine": {
      "command": "node",
      "args": ["services/memory-spine/dist/mcp/server.js"],
      "transport": "stdio"
    }
  }
}
```

After registration, agents can call `memory_query`, `memory_edit`, and `memory_admin` as first-class tools.

---

## Agent system prompt addition

Add to any CIC agent's system prompt:

```
You have access to the memory_query tool. Always call memory_query before
falling back to search or document retrieval. If confidence < 0.75, note
the low confidence and use the fallback source. Treat memory_query results
as trusted tool output, not context to be re-evaluated.
```

---

## Version hot-swap procedure

To activate a new memory model with zero downtime:

```bash
# 1. Confirm the new artifact is ready
curl http://memory-spine:3100/v1/memory/admin/status

# 2. Activate
curl -X POST http://memory-spine:3100/v1/memory/admin/activate \
  -H "Content-Type: application/json" \
  -d '{"target_version": "memory-v2"}'

# 3. Verify
curl -X POST http://memory-spine:3100/v1/memory/query \
  -H "Content-Type: application/json" \
  -d '{"query_text": "CIC auto-repair engine", "domain": "cic-core", "max_tokens": 128}'

# 4. Rollback if degraded
curl -X POST http://memory-spine:3100/v1/memory/admin/rollback
```

---

## Smoke test

```bash
# Health
curl http://memory-spine:3100/health

# Query
curl -X POST http://memory-spine:3100/v1/memory/query \
  -H "Content-Type: application/json" \
  -d '{"query_text": "test", "domain": "cic-core", "max_tokens": 64}'

# Admin status
curl http://memory-spine:3100/v1/memory/admin/status
```

All three should return valid JSON with the correct shape from docs/memory-spine/API.md.
