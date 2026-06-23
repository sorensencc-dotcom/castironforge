# WS-B: SLO Controller — SLO Targets

The SLO Controller enforces three primary SLO domains: Latency, Error-Rate, and Saturation.

## 1. Latency SLOs

Latency is measured across p50, p95, and p99 percentile windows.

| Percentile | Target | Hard Limit |
|------------|--------|-----------|
| p50 | < 20ms | 30ms |
| p95 | < 50ms | 75ms |
| p99 | < 80ms | 120ms |

Latency SLOs apply to:

- Adapter Gateway response times
- Ledger read‑path latency
- Ledger write‑path latency
- Pipeline orchestration latency

### Violation Triggers

- p95 > 75ms for 30s → warning
- p99 > 120ms for 30s → abort

---

## 2. Error‑Rate SLOs

Error‑rate is measured as:

```
error_rate = errors / total_requests
```

| Window | Target | Hard Limit |
|--------|--------|-----------|
| 1m | < 0.5% | 1% |
| 5m | < 0.3% | 0.7% |
| 30m | < 0.1% | 0.3% |

Error‑rate includes:

- Network failures
- Adapter timeouts
- Governance aborts
- Pipeline terminations

### Violation Triggers

- 1m error rate > 1% → abort
- 5m error rate > 0.7% → abort
- 30m error rate > 0.3% → warning + throttle

---

## 3. Saturation SLOs

Saturation measures system resource pressure.

| Resource | Target | Hard Limit |
|----------|--------|-----------|
| CPU usage | < 80% | 90% |
| Memory usage | < 85% | 95% |
| Queue depth | < 70% | 90% |
| Thread pool | < 75% | 90% |

### Violation Triggers

- Any saturation > 90% → immediate abort
- Any saturation > 85% for 60s → warning + throttle
- Memory usage > 95% → emergency shutdown

---

## 4. Global SLO Rules

### Readiness

- All SLOs must be met for M2 readiness
- All SLOs must be met for canary promotion
- Any SLO violation gates deployment

### Enforcement

- Any SLO violation triggers burn‑rate evaluation
- Any burn‑rate violation triggers enforcement action
- Enforcement is fail‑safe (prefer abort over continue)

### No Partial SLOs

- Either all SLOs are met (green) or none are (red)
- No "partial SLO" state — binary decision
- Transient violations do not affect readiness (use 30m window)

---

## 5. SLO Hierarchy

SLOs are evaluated in priority order:

1. **Saturation** (highest priority) — resource exhaustion is critical
2. **Error‑Rate** (medium priority) — correctness must hold
3. **Latency** (medium priority) — performance must be acceptable
4. **Burn‑Rate** (enforcement) — determines action severity

---

## 6. Acceptance Criteria

| Criterion | Target | Method |
|-----------|--------|--------|
| All latency SLOs met | p99 < 80ms | Prometheus scrape every 5s |
| All error-rate SLOs met | 1m < 0.5% | Rolling window counter |
| All saturation SLOs met | All < 90% | System metrics monitor |
| SLO evaluation latency | < 50ms | Per-decision timing |
| Enforcement latency | < 100ms | Abort signal to canary |
| No SLO drift | 0 | Continuous validation |
