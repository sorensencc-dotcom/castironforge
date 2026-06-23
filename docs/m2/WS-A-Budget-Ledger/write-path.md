# WS-A: Budget Ledger — Write Path

The write‑path is responsible for atomic, idempotent, schema‑validated ledger writes.

## 1. Input Validation

- Validate schema against `budget_ledger_v3`
- Reject malformed or missing fields
- Enforce monotonic cumulative values
- Enforce `projected_cost_usd >= cumulative_cost_usd`

## 2. Atomic Write

1. Begin transaction
2. Insert ledger entry
3. Update cumulative totals
4. Commit transaction
5. On failure: rollback and retry

## 3. Idempotency

- `entry_id` is the idempotency key
- Duplicate `entry_id` → no‑op (return success)
- Prevents duplicate accounting under retries

## 4. Retry Logic

- Deterministic exponential backoff: 100ms, 200ms, 400ms
- Max retries: 3
- Log structured error on final failure
- Emit `ledger_write_failure` metric

## 5. Governance Integration

- If `cumulative_tokens > budget` → emit `governance_abort`
- If `projected_cost_usd > threshold` → emit `governance_warning`
- Notify SLO Controller of abort condition
- Trigger canary gate abort if configured

## 6. Logging

Structured JSON log (per write):

```json
{
  "op": "ledger_write",
  "entry_id": "...",
  "agent_id": "...",
  "session_id": "...",
  "tokens_used": 150,
  "cost_usd": 0.00450,
  "cumulative_cost_usd": 2.34500,
  "projected_cost_usd": 5.00000,
  "status": "success|failure|duplicate",
  "latency_ms": 8,
  "error": null
}
```

## 7. SLA

- Write latency p95: < 20ms
- Write latency p99: < 40ms
- Write failure rate: < 0.1%
