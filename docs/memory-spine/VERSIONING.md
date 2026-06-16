# CIC Memory Spine — Versioning

How memory artifacts are versioned, activated, and rolled back.

---

## Version scheme

Memory artifacts follow a monotonically increasing integer scheme:

```
memory-v1
memory-v2
memory-v3
...
memory-vN
```

A version represents a specific trained model artifact bound to a corpus snapshot. Versions are immutable once created.

---

## Version manifest (versions.json)

The active version pointer is stored in `versions.json`:

```json
{
  "active": "memory-v3",
  "previous": "memory-v2",
  "available": ["memory-v1", "memory-v2", "memory-v3"],
  "history": [
    { "version": "memory-v1", "activated_at": "2026-04-01T00:00:00Z" },
    { "version": "memory-v2", "activated_at": "2026-05-01T00:00:00Z" },
    { "version": "memory-v3", "activated_at": "2026-05-11T00:00:00Z" }
  ]
}
```

This file is the single source of truth for which model answers queries. The Memory Router reads it at startup and caches the active pointer.

---

## Activation

Activating a new version updates the `active` pointer and records the previous version for rollback:

```
POST /v1/memory/admin/activate
{ "target_version": "memory-v4" }
```

Steps:
1. Validate that `memory-v4` artifact exists and its `manifest.json` is valid.
2. Swap the active pointer in `versions.json`.
3. Memory Router hot-reloads the new model (or swaps the pointer if pre-loaded).
4. Return `{ active_version, previous_version }`.

No downtime during activation. Existing in-flight queries complete against the old model; new queries go to the new model.

---

## Rollback

```
POST /v1/memory/admin/rollback
{ "to_version": "memory-v3" }
```

Rollback is identical to activation but uses the `previous` pointer as the default target if `to_version` is omitted. Completes in <1 second.

---

## Domain versioning (Phase 4+)

When multi-domain heads are enabled, each domain can have its own version:

```json
{
  "active": {
    "cic-core":  "memory-v3",
    "skills":    "memory-v2",
    "roadmap":   "memory-v1",
    "infra":     "memory-v3"
  }
}
```

The Memory Router selects the correct domain artifact based on the `domain` field in each query.

---

## Retention policy

By default, keep the last 3 versions available for rollback. Older versions can be archived to cold storage.

---

## Version drift detection

The orchestrator can detect version drift when agents query different Spine nodes and receive answers from different versions. The `memory_version` field in every MemoryQuery response is used to detect this. If drift is detected, the orchestrator forces a sync via MemoryAdmin.
