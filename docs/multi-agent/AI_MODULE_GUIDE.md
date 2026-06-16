# AI Module Development Guide

How to build AI-powered cataloging modules.

---

## Memory Spine integration (primary knowledge pattern)

CIC agents should call the Memory Spine before falling back to RAG or direct document search.

### Tool call pattern (MCP)

```json
{
  "type": "tool_use",
  "name": "memory_query",
  "input": {
    "query_text": "What is the CIC auto-repair engine architecture?",
    "task_type": "repair",
    "domain": "cic-core",
    "max_tokens": 256
  }
}
```

### Confidence gating

```
if response.confidence >= 0.75:
    use response.answer_text as trusted tool output
else:
    fall back to TorqueQuery or direct doc fetch
```

The `memory_version` field in every response tells the orchestrator which model artifact answered the query.

### Available tools

| Tool | Purpose |
|---|---|
| `memory_query` | Knowledge lookup — returns answer + provenance + confidence |
| `memory_edit` | Add/update/delete corpus documents |
| `memory_admin` | Activate, rollback, or inspect memory versions |

Full spec: [docs/memory-spine/AGENT_CALL_PATTERNS.md](../memory-spine/AGENT_CALL_PATTERNS.md)
