# WS-D: Fire Drills — Tests

Fire‑drills require unit, integration, and scenario‑level tests.

## Unit Tests (≥ 15)

### Scenario Runner (4 tests)
- Load scenario definition
- Initialize scenario environment
- Execute scenario deterministically
- Emit scenario result

### Event Collector (3 tests)
- Capture structured JSON events
- Aggregate events by time window
- Detect missing events

### Metrics Sampler (3 tests)
- Poll metrics at fixed intervals
- Handle metric unavailability
- Aggregate metrics correctly

### Result Aggregator (3 tests)
- Match events against success criteria
- Compute scenario pass/fail
- Generate aggregated result payload

### Rollback Logic (2 tests)
- Execute rollback steps in order
- Verify timing constraints
- Rollback idempotency

---

## Integration Tests (≥ 5)

### Ledger → Governance → SLO Chain

- Write to ledger triggers governance_warning
- Governance_warning read by observability
- Governance_abort propagates to SLO Controller
- SLO Controller receives abort immediately

### SLO → Canary → Rollback Chain

- SLO burn‑rate spike detected
- Canary gate receives violation
- Canary gate triggers rollback
- Rollback executes successfully

### Adapter Degradation → Caching → SLO Chain

- Adapter latency injected
- Cache absorbs load
- SLO detects P99 spike
- System remains stable

### Canary Rollback → State Reset

- Canary failure injects
- Rollback triggers
- Caches cleared
- Metrics reset
- Ledger consistent

### Multi‑Scenario Sequencing

- Budget exhaustion completes
- SLO burn‑rate scenario starts
- Adapter degradation completes
- Canary rollback completes
- Full drill passes

---

## Scenario Tests (4 total)

Each scenario test validates deterministic behavior, correct abort/rollback, correct metrics, correct logs, and no state drift.

### Scenario Test 1: Budget Exhaustion

```bash
npm run test:ws-d:scenario:budget-exhaustion
```

**Test Steps:**
1. Initialize ledger with $10 budget
2. Write entries totaling $15 in cost
3. Verify governance_abort emitted
4. Verify SLO Controller notified
5. Verify ledger state consistent
6. Verify metrics show exhaustion event

**Assertions:**
- ✓ governance_abort within 100ms
- ✓ SLO notified within 100ms
- ✓ No ledger drift
- ✓ Pipeline aborted

**Run:** `npm run test:ws-d:scenario:budget-exhaustion`

### Scenario Test 2: SLO Burn‑Rate Spike

```bash
npm run test:ws-d:scenario:slo-spike
```

**Test Steps:**
1. Establish baseline latency (P99 = 100ms)
2. Inject synthetic latency spike (P99 = 300ms)
3. Monitor burn‑rate (1m, 5m windows)
4. Verify SLO violation detected
5. Verify canary abort triggered
6. Verify rollback executes
7. Verify metrics return to baseline

**Assertions:**
- ✓ Burn‑rate > threshold detected
- ✓ SLO violation within 100ms
- ✓ Canary abort within 100ms
- ✓ Rollback < 300ms
- ✓ Metrics normalized within 60s

**Run:** `npm run test:ws-d:scenario:slo-spike`

### Scenario Test 3: Adapter Degradation

```bash
npm run test:ws-d:scenario:adapter-degradation
```

**Test Steps:**
1. Establish baseline adapter latency
2. Inject adapter degradation (slow responses)
3. Monitor cache hit‑rate
4. Monitor SLO metrics
5. Verify system stability
6. Verify cache absorption
7. Verify no cascading failures

**Assertions:**
- ✓ P99 latency spike detected
- ✓ Cache hit‑rate ≥ 85%
- ✓ SLO detects degradation
- ✓ No cascading failures
- ✓ System remains operational

**Run:** `npm run test:ws-d:scenario:adapter-degradation`

### Scenario Test 4: Canary Rollback

```bash
npm run test:ws-d:scenario:canary-rollback
```

**Test Steps:**
1. Deploy canary version v2 (instrumented)
2. Inject controlled failure (error rate spike)
3. Monitor rollback trigger
4. Verify rollback executes
5. Verify stable version v1 deployed
6. Verify state reset
7. Verify metrics reset
8. Verify no stale caches

**Assertions:**
- ✓ Rollback triggered < 100ms
- ✓ Rollback completes < 300ms (hard 500ms)
- ✓ Stable version v1 deployed
- ✓ No new requests to canary
- ✓ Caches cleared
- ✓ Ledger consistent
- ✓ Metrics reset

**Run:** `npm run test:ws-d:scenario:canary-rollback`

---

## Load Tests (2 scenarios)

### Load Test 1: Sustained Fire‑Drill Execution

- Duration: 10 minutes
- Scenarios: 4 sequential runs
- Parallelism: None (serial)
- Expected: All 4 scenarios pass every time

### Load Test 2: Fire‑Drill Under High System Load

- Concurrent user traffic: 1k req/s
- Fire‑drill execution: Budget exhaustion scenario
- Expected: Fire‑drill completes deterministically despite high load

---

## Acceptance Criteria

| Criterion | Target | Tolerance |
|-----------|--------|-----------|
| Unit test pass rate | ≥ 98% | 2% |
| Integration test pass rate | ≥ 95% | 5% |
| Scenario test pass rate | 100% (all 4 pass) | 0% |
| Budget exhaustion abort latency | < 100ms | ±20ms |
| SLO burn‑rate detection | < 200ms | ±50ms |
| Rollback latency | < 300ms | ±100ms (hard 500ms) |
| State drift | 0 detected | ±0 |
| Stale cache entries | 0 remaining | ±0 |
| Determinism violations | 0 | ±0 |
| Scenario reproducibility | 100% | 0% variance |

All tests must pass to gate M2 promotion.

---

## Test Execution

```bash
# Unit tests
npm run test:ws-d:unit

# Integration tests
npm run test:ws-d:integration

# Scenario tests
npm run test:ws-d:scenarios

# Load tests
npm run test:ws-d:load

# All tests
npm run test:ws-d
```

## Coverage Requirements

- Line coverage: ≥ 90%
- Branch coverage: ≥ 85%
- Function coverage: ≥ 90%

## CI/CD Integration

Fire‑drill tests are gated:

1. ✓ WS-A tests pass
2. ✓ WS-B tests pass
3. ✓ WS-C tests pass
4. **→ Run WS-D tests**
5. ✓ All WS-D tests pass
6. **→ Gate M2 promotion**
