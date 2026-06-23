# WS-D: Fire Drills — Scenarios

Fire‑drills consist of four primary scenarios, each validating a critical resilience surface.

## 1. Budget Exhaustion Scenario

Simulates rapid token/cost consumption to trigger:

- `governance_warning`
- `governance_abort`
- SLO Controller notification
- Pipeline termination

### Execution Steps

1. Initialize ledger with budget ceiling
2. Inject high-volume token writes
3. Monitor for governance_abort event
4. Verify pipeline termination
5. Validate ledger state and metrics

### Expected Outcome

System aborts within < 300ms, emits structured events, and leaves no partial state.

### Success Criteria

- ✓ `governance_abort` emitted
- ✓ Ledger cumulative totals correct
- ✓ Pipeline terminated
- ✓ SLO Controller notified within 100ms
- ✓ No partial writes

---

## 2. SLO Burn‑Rate Spike Scenario

Injects synthetic latency/error spikes to exceed:

- 1m burn‑rate threshold
- 5m burn‑rate threshold
- 30m burn‑rate threshold

### Execution Steps

1. Establish baseline latency
2. Inject synthetic spike (3x latency)
3. Monitor burn‑rate calculation
4. Observe canary gate trigger
5. Validate rollback execution

### Expected Outcome

SLO Controller triggers canary abort; rollback initiates; burn‑rate returns to baseline within 60s.

### Success Criteria

- ✓ Burn‑rate > threshold detected
- ✓ Canary abort triggered within 100ms
- ✓ Rollback executes (< 300ms)
- ✓ Burn‑rate returns to baseline
- ✓ No cascading failures

---

## 3. Adapter Degradation Scenario

Simulates:

- Slow upstream adapters (10s+ latency)
- Intermittent failures (50% error rate)
- Partial timeouts (connection hangs)
- Cascading latency (upstream slowdown)

### Execution Steps

1. Establish baseline adapter latency
2. Inject degradation (slow responses, failures)
3. Monitor cache hit‑rate and SLO
4. Observe SLO Controller trigger
5. Validate graceful degradation

### Expected Outcome

Adapter Gateway caching absorbs load; SLO Controller detects degradation; canary aborts.

### Success Criteria

- ✓ P99 latency spike detected
- ✓ Cache hit‑rate remains ≥ 85%
- ✓ SLO Controller triggers abort
- ✓ No cascading failures
- ✓ Metrics show containment

---

## 4. Canary Rollback Scenario

Forces a canary failure to validate:

- Rollback speed
- Rollback correctness
- State restoration
- Metric reset behavior

### Execution Steps

1. Deploy canary version (instrumented)
2. Inject controlled failure
3. Monitor rollback trigger
4. Verify state restoration
5. Validate metric reset

### Expected Outcome

Rollback completes in < 300ms with no residual state drift.

### Success Criteria

- ✓ Rollback executes within 300ms
- ✓ No new requests processed during rollback
- ✓ All metrics reset to baseline
- ✓ No stale cache entries
- ✓ No partial ledger writes
- ✓ Canary gates reset

---

## Scenario Sequencing

Scenarios run in this order (serial):

1. Budget Exhaustion (simplest; lowest risk)
2. SLO Burn‑Rate Spike (moderate; depends on WS-B)
3. Adapter Degradation (complex; depends on WS-C)
4. Canary Rollback (final; depends on all WS)

Each scenario must complete and validate before the next begins.

---

## Determinism Requirements

- Same inputs → same outputs
- No nondeterministic timing
- No race conditions
- No partial state
- Idempotent execution
