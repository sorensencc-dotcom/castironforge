# WS-B: SLO Controller — Tests

The SLO Controller requires high‑coverage, deterministic testing.

## Unit Tests (≥ 30)

### SLO Evaluation (6 tests)
- Latency SLO: p50, p95, p99 evaluation
- Error-rate SLO: rolling window calculation
- Saturation SLO: all resource types
- SLO violation detection
- SLO green/red state transition
- SLO history tracking

### Burn-Rate Calculation (8 tests)
- 1m burn-rate computation
- 5m burn-rate computation
- 30m burn-rate computation
- Error budget normalization
- Divide-by-zero handling
- Low-traffic data handling
- Burn-rate state transitions
- Multi-window independence

### Enforcement Selection (6 tests)
- Warning trigger (30m > 3×)
- Throttle trigger (30m > 3× sustained)
- Abort trigger (5m > 6×)
- Immediate abort trigger (1m > 14×)
- Saturation abort (> 90%)
- Action precedence (1m > 5m > 30m)

### Prometheus Metrics (5 tests)
- Metric formatting (text format)
- Histogram bucket distribution
- Counter monotonicity
- Gauge accuracy
- No-op scrapes (idempotency)

### Structured Logging (5 tests)
- JSON event logging
- Field presence validation
- Timestamp accuracy
- Event sequencing
- Circular buffer cleanup

---

## Integration Tests (≥ 10)

### SLO → Canary Abort Chain

- SLO detects burn-rate 5m > 6×
- Canary Gates receive abort signal
- Abort < 100ms from detection
- Canary version stops accepting traffic

### SLO → Canary Rollback Chain

- Abort signal triggers rollback
- Rollback < 300ms
- Stable version deployed
- Metrics reset
- SLO recalculation valid

### SLO → Ledger Governance

- SLO violation → governance signal
- Ledger receives signal within 100ms
- Governance state updated

### SLO → Adapter Gateway

- SLO detects latency spike
- Adapter Gateway notified
- Cache hit-rate maintained ≥ 85%
- System remains stable

### Prometheus Scrape Reliability

- 1000 consecutive scrapes
- ≥ 99.9% success rate
- No metric corruption
- No CPU spike (< 20ms per scrape)

### Multi-Window Coordination

- 1m, 5m, 30m windows run independently
- Precedence enforced correctly
- No race conditions
- Deterministic ordering

---

## Load Tests

### Load Test 1: High-Frequency Scrapes (5000 req/sec)

```bash
npm run test:ws-b:load:sustained
```

**Configuration:**
- Duration: 60s
- Scrape interval: 5s
- Concurrent scrapers: 3
- Metrics per scrape: 25

**Expected:**
- Scrape latency p99 < 5ms
- Memory stable (< 2% drift)
- CPU < 10ms per scrape
- 0 metric corruptions

### Load Test 2: Burst Scrapes (20k req/sec for 5s)

```bash
npm run test:ws-b:load:burst
```

**Configuration:**
- Burst duration: 5s
- Burst rate: 20k req/sec
- Baseline: 100 req/s

**Expected:**
- Recovery to baseline < 30s
- No dropped scrapes
- No memory leak
- Metrics accurate post-burst

### Load Test 3: SLO Evaluation Under Load

```bash
npm run test:ws-b:load:slo-eval
```

**Configuration:**
- Application load: 10k req/s
- SLO evaluation: every 5s
- Burn-rate windows: 1m, 5m, 30m

**Expected:**
- SLO evaluation latency < 50ms
- Enforcement latency < 100ms
- 0 missed evaluations
- Correct decisions under load

---

## Scenario Tests

### Scenario 1: Latency SLO Violation

```bash
npm run test:ws-b:scenario:latency-violation
```

**Steps:**
1. Establish baseline: p99 = 75ms
2. Inject latency spike: p99 → 150ms
3. Monitor SLO evaluation
4. Verify warning emitted
5. Verify throttle triggered (if sustained)

**Expected:**
- Warning within 50ms
- p99 > 120ms detected correctly
- Throttle triggered if > 30s sustained

### Scenario 2: Error-Rate SLO Violation

```bash
npm run test:ws-b:scenario:error-rate-violation
```

**Steps:**
1. Establish baseline: error_rate = 0.3%
2. Inject error spike: error_rate → 2%
3. Monitor burn-rate calculation
4. Verify abort triggered
5. Verify canary abort signal sent

**Expected:**
- Burn-rate > 6× (5m) detected
- Abort signal within 100ms
- Canary rollback initiated

### Scenario 3: Burn-Rate Multi-Window

```bash
npm run test:ws-b:scenario:burn-rate-windows
```

**Steps:**
1. Start with clean state
2. Inject moderate error rate (0.6%)
3. Monitor 1m, 5m, 30m windows
4. Verify correct precedence
5. Verify decisions respect windows

**Expected:**
- 1m: warn (if > 0.5%)
- 5m: pattern detection
- 30m: baseline reconciliation
- Precedence: 1m > 5m > 30m

### Scenario 4: Canary Abort → Rollback

```bash
npm run test:ws-b:scenario:canary-abort-rollback
```

**Steps:**
1. Deploy canary version
2. Inject burn-rate spike (1m > 14×)
3. Verify abort signal emitted
4. Verify rollback initiates
5. Verify metrics reset
6. Verify stable version operational

**Expected:**
- Abort < 50ms
- Rollback < 300ms (hard 500ms)
- Metrics reset to baseline
- No residual state

---

## Acceptance Criteria

| Criterion | Target | Tolerance |
|-----------|--------|-----------|
| Unit test pass rate | ≥ 98% | 2% |
| Integration test pass rate | ≥ 95% | 5% |
| SLO evaluation latency | < 50ms | ±10ms |
| Enforcement latency | < 100ms | ±20ms |
| Burn-rate accuracy | ±0.1× | ±0.05× |
| Scrape success rate | ≥ 99.9% | 0.1% |
| Determinism violations | 0 | ±0 |
| No metric corruption | 0 | ±0 |

---

## Test Execution

```bash
# Unit tests
npm run test:ws-b:unit

# Integration tests
npm run test:ws-b:integration

# Scenario tests
npm run test:ws-b:scenarios

# Load tests
npm run test:ws-b:load

# All tests
npm run test:ws-b
```

---

## Coverage Requirements

- Line coverage: ≥ 90%
- Branch coverage: ≥ 85%
- Function coverage: ≥ 90%

---

## CI/CD Gating

WS-B tests gate M2 promotion:

1. ✓ WS-A tests pass (Budget Ledger)
2. **→ Run WS-B tests (SLO Controller)**
3. ✓ WS-B tests pass
4. ✓ WS-C tests pass (Adapter Gateway Cache)
5. ✓ WS-D tests pass (Fire Drills)
6. **→ Gate M2 promotion**
