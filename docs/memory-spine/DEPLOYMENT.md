# CIC Memory Spine — Deployment

Service topology, node layout, and operational configuration.

---

## Single-service topology

The Memory Spine is deployed as one logical service. All four API surfaces (Query, Edit, Admin, Provenance) run in the same process on port 3100.

```
┌─────────────────────────┐
│   memory-spine:3100     │
│                         │
│  POST /v1/memory/query  │
│  POST /v1/memory/edit   │
│  POST /v1/memory/admin  │
│  GET  /v1/memory/prov.. │
│                         │
│  ┌─────────────────┐    │
│  │  ./data/        │    │
│  │  corpus/        │    │
│  │  versions.json  │    │
│  └─────────────────┘    │
└─────────────────────────┘
```

---

## Minimum viable deployment (Phase 1–2)

Run locally with the stub service:

```bash
cd services/memory-spine
npm install
npm run dev        # starts on port 3100 with file-backed stub store
```

No external dependencies. Corpus is stored in `services/memory-spine/data/`.

---

## Production deployment

```
CIC Orchestrator
       │
       │  HTTP
       ▼
Memory Spine (primary)
  memory-spine:3100
       │
       │  reads
       ▼
Corpus Store
  ./data/corpus/*.json
  ./data/versions.json
```

The orchestrator URL is configured via:

```json
{
  "memory_spine": {
    "url": "http://memory-spine:3100"
  }
}
```

---

## Local node deployment

For the old Mac node (low-resource scenario):

- Run the lightweight stub or a distilled memory model.
- Serve a local subset of the corpus (e.g., `cic-core` domain only).
- The central CIC Orchestrator can treat it as a remote memory shard:

```json
{
  "memory_spine": {
    "shards": [
      { "id": "central", "url": "http://memory-spine-central:3100", "domains": ["cic-core", "skills", "roadmap", "infra"] },
      { "id": "mac-node", "url": "http://mac-node:3100", "domains": ["cic-core"] }
    ],
    "shard_selection": "domain"
  }
}
```

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `MEMORY_SPINE_PORT` | `3100` | HTTP listen port |
| `MEMORY_SPINE_DATA_DIR` | `./data` | Path to corpus and version store |
| `MEMORY_SPINE_LOG_LEVEL` | `info` | Log verbosity |
| `MEMORY_SPINE_CONFIDENCE_THRESHOLD` | `0.75` | Default threshold for orchestrator |

---

## Health check

```
GET /health

{ "status": "ok", "active_version": "memory-v3", "uptime_seconds": 3600 }
```

---

## Upgrade procedure

1. Build new memory artifact: `memory-vN`
2. Copy artifact to `services/memory-spine/data/models/memory-vN/`
3. Activate: `POST /v1/memory/admin/activate { "target_version": "memory-vN" }`
4. Verify: `GET /v1/memory/admin/status`
5. Smoke-test: send a known query, verify confidence and answer
6. If degraded: `POST /v1/memory/admin/rollback`
