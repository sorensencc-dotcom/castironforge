# CIC Memory Spine — API Reference

All endpoints are deterministic, idempotent, and LLM-agnostic.  
Base URL: `http://localhost:3100` (local) or the configured Memory Spine service URL.

---

## MemoryQuery

Return a compact, authoritative answer to a CIC question, independent of corpus size.

**Endpoint:** `POST /v1/memory/query`

### Request

```json
{
  "query_text": "What is the CIC auto-repair engine architecture",
  "task_type": "build",
  "domain": "cic-core",
  "time_hint": "2026-06-16T07:02:00-04:00",
  "max_tokens": 256
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `query_text` | string | yes | The natural-language question |
| `task_type` | string | no | Hint for memory router: `build`, `repair`, `plan`, `inspect` |
| `domain` | string | no | Knowledge domain: `cic-core`, `skills`, `roadmap`, `infra` |
| `time_hint` | ISO 8601 | no | Prefer documents valid at this timestamp |
| `max_tokens` | number | no | Max answer length (default: 256) |

### Response

```json
{
  "answer_text": "The CIC auto-repair engine consists of the restart engine, repair engine, state recovery manager, and orchestrator.",
  "provenance": [
    { "doc_id": "adr-42", "chunk_id": "c7", "timestamp": "2026-05-10" }
  ],
  "confidence": 0.92,
  "memory_version": "memory-v3"
}
```

| Field | Type | Description |
|---|---|---|
| `answer_text` | string | The memory model's answer |
| `provenance` | array | Source documents and chunks |
| `confidence` | float [0,1] | Model confidence; orchestrator gates on this |
| `memory_version` | string | Which memory artifact produced this answer |

---

## MemoryEdit

Modify the knowledge corpus without retraining the LLM.

**Endpoint:** `POST /v1/memory/edit`

### Request

```json
{
  "operation": "update",
  "doc_id": "adr-42",
  "payload": {
    "title": "CIC Auto-Repair Engine v2",
    "content": "Updated architecture including new DLQ pruning logic."
  }
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `operation` | enum | yes | `add`, `update`, or `delete` |
| `doc_id` | string | yes | Target document identifier |
| `payload` | object | no | Document fields; omit for `delete` |

### Payload fields

| Field | Type | Description |
|---|---|---|
| `title` | string | Document title |
| `content` | string | Full document content |
| `domain` | string | Knowledge domain tag |
| `tags` | string[] | Additional tags |

### Response

```json
{
  "status": "ok",
  "version": "memory-v4"
}
```

---

## MemoryAdmin

Manage memory model versions.

### Activate

**Endpoint:** `POST /v1/memory/admin/activate`

```json
{ "target_version": "memory-v4" }
```

Response:

```json
{
  "active_version": "memory-v4",
  "previous_version": "memory-v3"
}
```

### Rollback

**Endpoint:** `POST /v1/memory/admin/rollback`

```json
{ "to_version": "memory-v3" }
```

Response:

```json
{
  "active_version": "memory-v3",
  "rolled_back_from": "memory-v4"
}
```

### Status

**Endpoint:** `GET /v1/memory/admin/status`

Response:

```json
{
  "active_version": "memory-v3",
  "available_versions": ["memory-v1", "memory-v2", "memory-v3"],
  "corpus_doc_count": 142,
  "last_edit": "2026-06-16T10:00:00Z"
}
```

---

## MemoryProvenance

Trace where an answer came from across memory versions.

**Endpoint:** `GET /v1/memory/provenance/{doc_id}`

Response:

```json
{
  "doc_id": "adr-42",
  "history": [
    { "version": "memory-v1", "timestamp": "2026-04-01" },
    { "version": "memory-v3", "timestamp": "2026-05-10" }
  ]
}
```

| Field | Type | Description |
|---|---|---|
| `doc_id` | string | Document identifier |
| `history` | array | Each version in which this doc appeared or was edited |

---

## Error responses

All endpoints return standard error shapes:

```json
{
  "error": "doc_not_found",
  "message": "Document adr-99 does not exist in the corpus.",
  "status": 404
}
```

Common error codes: `doc_not_found`, `invalid_operation`, `version_not_found`, `model_unavailable`.
