# WS-D: Fire Drills — Harness

The Fire‑Drill Harness orchestrates scenario execution, logging, and validation.

## 1. Architecture

The harness consists of:

- **Scenario Runner** — executes each scenario deterministically
- **Event Collector** — captures structured logs from all subsystems
- **Metrics Sampler** — polls SLO + ledger metrics at fixed intervals
- **Result Aggregator** — computes pass/fail for each scenario
- **Report Generator** — produces final drill report with timeline and outcomes

## 2. Execution Model

Each scenario runs in the following order:

1. **Initialize environment** — clear caches, reset metrics, set budget ceiling
2. **Warm caches** — pre-populate with baseline data
3. **Execute scenario** — inject failure condition
4. **Collect metrics** — sample latency, errors, burn‑rate, ledger state
5. **Validate outcomes** — check against success criteria
6. **Emit structured results** — log final drill result

## 3. Event Collection

### Structured Logging

All logs must be structured JSON:

```json
{
  "op": "fire_drill",
  "scenario": "adapter_degradation",
  "phase": "execute",
  "timestamp": "2026-06-23T12:34:56Z",
  "latency_ms": 123,
  "status": "success",
  "metrics": {
    "burn_rate_1m": 0.8,
    "cache_hit_rate": 0.92,
    "p99_latency_ms": 450
  }
}
```

### Collection Points

- Budget Ledger writes (every write)
- Governance events (abort/warning)
- SLO Controller decisions (burn‑rate triggers)
- Adapter Gateway decisions (cache hit/miss)
- Canary gate decisions (abort/continue)
- Rollback execution (start/complete)

## 4. Metrics Sampling

### Sampling Interval

- Every 100ms during scenario execution
- Higher frequency during critical phases (exhaustion, rollback)

### Metrics Collected

- `ledger_writes_total`
- `ledger_write_failures_total`
- `ledger_write_latency_ms` (p50, p95, p99)
- `budget_exhaustion_events_total`
- `governance_abort_total`
- `slo_burn_rate_1m`
- `slo_burn_rate_5m`
- `slo_burn_rate_30m`
- `cache_hit_rate`
- `cache_evictions_total`
- `adapter_latency_ms` (p50, p95, p99)
- `canary_rollback_duration_ms`

## 5. Result Aggregation

After each scenario:

1. Collect all structured logs
2. Match against expected events
3. Compute timeline
4. Check success criteria
5. Emit aggregated result

### Result Payload

```json
{
  "scenario": "budget_exhaustion",
  "status": "passed",
  "duration_ms": 1234,
  "events_count": 42,
  "success_criteria": [
    { "criterion": "governance_abort_emitted", "passed": true },
    { "criterion": "ledger_state_correct", "passed": true },
    { "criterion": "pipeline_terminated", "passed": true }
  ],
  "metrics": {
    "abort_latency_ms": 87,
    "max_concurrent_requests": 156
  }
}
```

## 6. Report Generation

Final drill report includes:

- Timestamp and duration
- Scenario results (passed/failed)
- Timeline of key events
- Metrics summary
- Failure details (if any)
- Recommendations for remediation

## 7. Determinism Guarantees

- **Idempotent** — running twice produces identical results
- **No nondeterministic timing** — all timeouts explicitly configured
- **No race conditions** — serial execution, locked state transitions
- **No partial state** — all-or-nothing at each phase boundary

## 8. Cleanup

After each scenario:

1. Clear all in-flight requests
2. Reset metrics counters
3. Clear caches
4. Return ledger to initial state
5. Verify clean state before next scenario
