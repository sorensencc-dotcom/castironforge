# WS-A: Budget Ledger — Tests

The Budget Ledger requires high‑coverage, deterministic testing.

## Unit Tests (≥ 40)

### Schema & Validation (8 tests)
- Valid schema accepts correct payload
- Invalid schema rejects malformed entry_id
- Invalid schema rejects missing agent_id
- Monotonic enforcement: rejects if `cumulative_cost_usd < previous`
- Constraint: `projected_cost_usd >= cumulative_cost_usd`
- Constraint: all required fields present
- Timestamp parsing and timezone handling
- JSONB metadata validation

### Atomic Write Behavior (8 tests)
- Single write succeeds atomically
- Transaction rollback on constraint violation
- No partial writes on failure
- All‑or‑nothing semantics on budget update
- Cumulative totals updated correctly
- Governance hooks triggered within transaction
- Write to empty ledger succeeds
- Write with large batch succeeds

### Idempotency (4 tests)
- Duplicate `entry_id` returns success
- Duplicate write does not duplicate entry
- Duplicate write does not increment counters
- Duplicate write with different data rejects (conflict)

### Cumulative Totals (6 tests)
- Cumulative tokens increment correctly
- Cumulative cost increment correctly
- Running sum maintains monotonicity
- Multiple sequential writes accumulate correctly
- Reset scenario (new session) starts at 0
- Per‑agent totals isolated

### Projected Cost (3 tests)
- Projected cost >= cumulative cost
- Projected cost updates on new write
- Projected cost calculation for long‑running tasks

### Governance Triggers (5 tests)
- Budget exhaustion triggers abort
- Threshold warning triggers at 70% consumed
- Governance abort event emitted correctly
- Governance warning event emitted correctly
- Multiple governance events in sequence handled correctly

### Retry Logic (4 tests)
- Single failure retries and succeeds
- Max retries (3) exhausted logs error
- Exponential backoff: 100ms, 200ms, 400ms
- Idempotency prevents duplicate on retry

## Integration Tests (≥ 12)

### Write → Read Consistency (4 tests)
- Write entry, immediately read latest, matches
- Write, read, write again, read shows correct cumulative
- No stale reads beyond 50ms window
- Consistency maintained under concurrent writes

### Governance Abort Propagation (2 tests)
- Budget exhaustion triggers abort
- SLO Controller notified synchronously

### SLO Controller Integration (2 tests)
- SLO Controller can read ledger for burn‑rate
- SLO Controller reacts to governance abort

### Canary Gate Read‑Path Latency (2 tests)
- Canary gate read < 15ms p95
- Canary gate read < 25ms p99

### Adapter Gateway Interactions (2 tests)
- Budget writes during active pipeline
- Adapter Gateway aborts on governance_abort

## Load Tests (3 scenarios)

### Scenario 1: Sustained Load (5k writes/sec)
- Duration: 60s
- Expected: p99 latency < 40ms, no failures, metrics accurate
- Validation: write_latency_p99 < 40ms, write_failures_total = 0

### Scenario 2: Burst Load (20k writes/sec for 5s)
- Duration: 5s burst, then return to baseline
- Expected: latency spike < 100ms, recovery to normal within 10s
- Validation: recovery_time < 10s, no data loss

### Scenario 3: Mixed Read/Write (70% reads, 30% writes)
- Duration: 60s at 10k ops/sec
- Expected: read_latency_p99 < 25ms, write_latency_p99 < 40ms
- Validation: read_latency_p99 < 25ms, write_latency_p99 < 40ms

## Acceptance Criteria

| Criterion | Target | Tolerance |
|-----------|--------|-----------|
| Unit test pass rate | ≥ 98% | 2% |
| Integration test pass rate | ≥ 95% | 5% |
| Load test p99 write latency | < 40ms | ±5ms |
| Load test p99 read latency | < 25ms | ±5ms |
| Drift detection | 0 detected | ±0 |
| Stale reads | 0 beyond 50ms | ±0 |
| Governance event latency | < 10ms | ±2ms |

## Test Execution

```bash
# Unit tests
npm run test:ws-a:unit

# Integration tests
npm run test:ws-a:integration

# Load tests
npm run test:ws-a:load

# All tests
npm run test:ws-a
```

## Coverage Requirements

- Line coverage: ≥ 90%
- Branch coverage: ≥ 85%
- Function coverage: ≥ 90%
