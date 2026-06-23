# WS-D: Fire Drills — Validation

Validation ensures each fire‑drill scenario produces deterministic, correct outcomes.

## 1. Budget Exhaustion Validation

### Expected Events

- `governance_warning` emitted
- `governance_abort` emitted
- SLO Controller notified
- Pipeline terminated

### Validation Checks

| Check | Condition | Pass Criteria |
|-------|-----------|---------------|
| Governance warning | Projected cost > 70% of budget | Warning emitted within 50ms |
| Governance abort | Cumulative cost > budget ceiling | Abort emitted within 100ms |
| Ledger consistency | No drift in cumulative totals | Cumulative always monotonic |
| Pipeline termination | Active pipeline stopped | All in-flight requests aborted |
| SLO notification | SLO Controller receives abort | Notification within 100ms |
| No partial state | Ledger writes atomic | All writes succeed or all fail |

### Failure Conditions

- ✗ Abort not emitted
- ✗ Abort delayed > 300ms
- ✗ Ledger drift detected
- ✗ Pipeline continues after abort
- ✗ Partial writes in ledger

---

## 2. SLO Burn‑Rate Validation

### Expected Events

- Burn‑rate threshold exceeded (1m, 5m, or 30m)
- SLO Controller detects violation
- Canary gate triggers abort
- Rollback initiates
- Metrics return to baseline

### Validation Checks

| Check | Condition | Pass Criteria |
|-------|-----------|---------------|
| Latency spike | P99 latency injected | Spike detected within 200ms |
| Burn‑rate calculation | Rolling window computed | Burn‑rate > threshold |
| SLO violation | Threshold exceeded | Violation emitted within 100ms |
| Canary trigger | Gate receives violation | Canary abort within 100ms |
| Rollback execution | Rollback initiated | Rollback completes < 300ms |
| Metric reset | Metrics return to baseline | Baseline achieved within 60s |
| No cascading failures | System stable post-rollback | No secondary failures |

### Failure Conditions

- ✗ Burn‑rate not calculated
- ✗ SLO violation not detected
- ✗ Canary abort not triggered
- ✗ Rollback not executed
- ✗ Rollback exceeds 500ms
- ✗ Metrics remain elevated > 120s

---

## 3. Adapter Degradation Validation

### Expected Events

- Adapter latency increases
- Cache hit‑rate maintained ≥ 85%
- SLO Controller detects p99 increase
- Canary gate may trigger
- System remains stable

### Validation Checks

| Check | Condition | Pass Criteria |
|-------|-----------|---------------|
| P99 spike | Upstream adapter slowed | P99 increases > 50% baseline |
| Cache absorption | Requests served from cache | Cache hit‑rate ≥ 85% |
| SLO detection | P99 latency monitored | SLO Controller detects spike |
| Cascading prevention | No cascading delays | P95/P50 remain stable |
| Adapter fallback | Circuit breaker engages | Failing adapter isolated |
| Load distribution | Traffic redistributed | No single bottleneck |

### Failure Conditions

- ✗ Cache hit‑rate drops below 85%
- ✗ Cascading latency (P95 > 2x baseline)
- ✗ Adapter not isolated
- ✗ Canary gate fails to detect
- ✗ Request failures spike

---

## 4. Canary Rollback Validation

### Expected Events

- Canary failure injected
- Rollback triggered
- Stable version deployed
- State restored
- Metrics reset
- System operational

### Validation Checks

| Check | Condition | Pass Criteria |
|-------|-----------|---------------|
| Rollback trigger | Canary fails | Rollback initiated < 100ms |
| Freeze new requests | No new traffic to canary | Requests freeze within 50ms |
| Abort active pipelines | In-flight requests stopped | Abort completes within 100ms |
| Deploy stable | Previous version deployed | Deployment succeeds < 100ms |
| Cache reset | All caches cleared | Reset completes < 50ms |
| SLO reset | Metrics zeroed | Reset completes < 50ms |
| State consistency | No partial state | Ledger consistent, no drift |
| Stale entries | No stale cache entries | Cache validated post-reset |
| Total rollback time | Full sequence completes | Total < 300ms (target), < 500ms (hard ceiling) |
| Operational ready | System ready for requests | Health checks pass |

### Failure Conditions

- ✗ Rollback not triggered
- ✗ Rollback exceeds 500ms
- ✗ New requests processed during rollback
- ✗ Stable version deployment fails
- ✗ Cache still contains stale entries
- ✗ SLO metrics not reset
- ✗ Ledger drift detected
- ✗ Health checks fail post-rollback

---

## 5. Global Validation Rules

### All Scenarios Must

- ✓ Pass deterministically (same inputs → same outputs)
- ✓ Emit structured logs for all events
- ✓ Produce a final drill report
- ✓ Leave the system in a clean state
- ✓ Restore all metrics to baseline
- ✓ Clear all caches
- ✓ Reset all governance state
- ✓ Complete within timing SLA

### No Partial State Allowed

- No incomplete ledger writes
- No stale cache entries
- No orphaned pipelines
- No residual metrics
- No leaked governance state

### No Cascading Failures

- Single failure must not trigger secondary failures
- System must remain stable after rollback
- No resource exhaustion
- No infinite loops or retries

### Logging Requirements

- All events logged as structured JSON
- All failures logged with full context
- All rollback steps logged
- Timestamp on every entry

---

## 6. Acceptance Criteria

| Criterion | Target | Tolerance |
|-----------|--------|-----------|
| Budget exhaustion abort latency | < 100ms | ±20ms |
| SLO burn‑rate detection | < 200ms | ±50ms |
| Adapter degradation absorption | Cache ≥ 85% | ±5% |
| Canary rollback time | < 300ms | ±100ms (hard 500ms) |
| All scenarios pass | 100% | 0% failure |
| No state drift | 0 detected | ±0 |
| No stale cache | 0 remaining | ±0 |
| Determinism | 100% reproducible | ±0 variance |

All scenarios must pass to gate M2 promotion.
