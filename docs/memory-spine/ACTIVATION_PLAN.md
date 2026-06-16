# CIC Memory Spine — Memory-v1 Activation Plan

## 1. Preconditions

Before activating `memory-v1` in any environment, verify:

**Model artifacts present** in `models/memory-v1/`:
- `weights.bin` (or LoRA adapter files)
- `tokenizer/`
- `config.json`
- `calibration.json` (from `npm run calibrate-confidence`)
- `provenance_schema.json`

**Evaluation thresholds met** (from `train-config.json` eval suite):
- QA accuracy ≥ target on held-out set
- Multi-hop accuracy ≥ target
- Confidence Brier score within budget
- P99 latency within SLA

---

## 2. Staging activation

1. Point the staging Memory Spine at `memory-v1`:

```http
POST http://staging-memory-spine:3100/v1/memory/admin/activate
Content-Type: application/json

{
  "target_version": "memory-v1"
}
```

2. Confirm:

```http
GET http://staging-memory-spine:3100/v1/memory/admin/status
```

Expected: `"active_version": "memory-v1"`

3. Run regression Q&A suite against staging:
   - Spot-check confidence distribution across domains.
   - Verify provenance pointers resolve to real doc IDs.
   - Check latency under load.

---

## 3. Production activation

Once staging passes:

```http
POST http://memory-spine:3100/v1/memory/admin/activate
Content-Type: application/json

{
  "target_version": "memory-v1"
}
```

Verify:

```bash
curl -s http://memory-spine:3100/health | jq '.active_version'
# → "memory-v1"

curl -s -X POST http://memory-spine:3100/v1/memory/query \
  -H 'Content-Type: application/json' \
  -d '{"query_text":"confidence gating threshold","domain":"cic-core","max_tokens":128}' \
  | jq '{memory_version, confidence}'
# → {"memory_version": "memory-v1", "confidence": <value>}
```

---

## 4. Post-activation monitoring (24–48h)

Track:
- Error rate on `/v1/memory/query`
- P50 / P99 latency
- Confidence distribution vs `calibration.json` bins
- Agent fallback rate (low confidence → TorqueQuery)

---

## 5. Rollback

If error rate spikes or accuracy regresses:

```http
POST http://memory-spine:3100/v1/memory/admin/rollback
Content-Type: application/json

{}
```

This restores `previous` (the version active before `memory-v1`).

To roll back to a specific version:

```http
POST http://memory-spine:3100/v1/memory/admin/rollback
Content-Type: application/json

{
  "to_version": "memory-v0"
}
```

See `ACTIVATION_ROLLBACK.md` for safety gates and full rollback procedure.
