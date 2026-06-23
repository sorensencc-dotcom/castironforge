# WS-A: Budget Ledger — Read Path

The read‑path provides low‑latency, consistent access to ledger state.

## 1. Query Patterns

### Latest Entry

- Query latest entry for agent/session
- Used by SLO Controller, Canary Gates, observability
- Must return current state

### Rolling Window

- 1m, 5m, 30m windows
- Sum of `tokens_used` and `cost_usd` in window
- Used for burn‑rate calculation (WS-B)

### Cumulative Totals

- Total tokens consumed by agent
- Total cost accumulated by agent
- Used for budget enforcement

### Projected Cost

- Estimated total cost to completion
- Used for governance warnings

## 2. Consistency Requirements

- Read‑after‑write consistency (strict)
- No stale reads beyond 50ms
- Drift detection on cumulative totals
- Fail if consistency violation detected

## 3. Latency Targets

- p95 < 15ms
- p99 < 25ms
- Canary gates depend on this SLA

## 4. Caching

- Optional L1 cache for hot reads
- TTL ≤ 50ms
- Must not violate consistency guarantees
- Cache invalidation on write

## 5. Logging

Structured JSON log (per read):

```json
{
  "op": "ledger_read",
  "agent_id": "...",
  "session_id": "...",
  "query_type": "latest|rolling_window|cumulative",
  "window_secs": 60,
  "latency_ms": 4,
  "cached": false,
  "rows_returned": 1
}
```

## 6. SLA

- Read latency p95: < 15ms
- Read latency p99: < 25ms
- Read consistency: strict (no stale reads > 50ms)
- Read failure rate: < 0.05%
