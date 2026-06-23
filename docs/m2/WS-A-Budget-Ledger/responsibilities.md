# WS-A: Budget Ledger — Responsibilities

The Budget Ledger is responsible for:

## 1. Token Budgeting

- Track per‑request, per‑session, and per‑agent token usage
- Enforce budget ceilings
- Predict exhaustion based on rolling usage

## 2. Cost Tracking

- Compute unit cost per operation
- Maintain cumulative cost
- Track projected cost for long‑running tasks
- Emit cost deltas for monitoring

## 3. Rate Limiting

- Budget‑aware throttling
- Burst‑limit enforcement
- Rolling‑window rate calculations

## 4. Governance Hooks

- Trigger aborts when budgets are exceeded
- Trigger warnings when thresholds approach
- Provide structured events for audit

## 5. Write Path

- Atomic, idempotent writes
- Schema‑validated payloads
- Deterministic retry logic

## 6. Read Path

- Low‑latency reads for SLO + canary gates
- Consistent view of budget state
- Drift detection

## 7. Metrics

- `writes/sec`
- `failures/sec`
- `ledger_latency_p95/p99`
- `drift_count`
- `budget_exhaustion_events`

## 8. Integration Points

- SLO Controller
- Adapter Gateway
- Canary Gates
- Fire‑Drills
- Observability Dashboard
