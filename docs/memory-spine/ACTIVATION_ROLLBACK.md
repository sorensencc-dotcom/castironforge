# CIC Memory Spine — Activation & Rollback

## 1. Preconditions

- `models/memory-vN/` exists with:
  - `weights.bin`
  - `tokenizer/`
  - `config.json`
  - `calibration.json`
  - `provenance_schema.json`
- Validation suite has passed for `memory-vN`.

## 2. Activation

1. Call MemoryAdmin:

```http
POST /v1/memory/admin/activate
{
  "target_version": "memory-vN"
}
```

2. Verify:
   - `GET /v1/memory/admin/status` returns `active_version = memory-vN`.
   - `POST /v1/memory/query` returns answers tagged with `memory_version = "memory-vN"`.

3. Monitor:
   - Latency, error rate, confidence distribution.
   - Compare against previous version using calibration curves.

## 3. Rollback

1. Identify previous stable version, e.g. `memory-vN-1`.

2. Call:

```http
POST /v1/memory/admin/rollback
{
  "to_version": "memory-vN-1"
}
```

3. Verify:
   - `active_version = memory-vN-1`.
   - Queries now report `memory_version = "memory-vN-1"`.

4. Record incident:
   - Reason for rollback.
   - Impact on agents.
   - Follow-up actions for `memory-vN`.

## 4. Safety

- Never auto-activate a new memory version without passing:
  - Accuracy thresholds.
  - Calibration thresholds.
  - Latency budgets.
- Keep at least one known-good version available for instant rollback.
- Rollback completes in < 1 second (version pointer swap only — no model reload).
