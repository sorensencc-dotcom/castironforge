# WS-B: SLO Controller — Enforcement

Enforcement is the SLO Controller's mechanism for acting on violations.

## 1. Enforcement Types

Enforcement actions are categorized by severity and reversibility:

### Soft Enforcement

Soft enforcement is low-risk and reversible:

- **Logging** — structured event logging
- **Warning events** — emit governance warnings
- **Throttling** — reduce request throughput (50-90%)
- **Cache warmup** — proactive cache population
- **Request prioritization** — route high-value traffic first

### Hard Enforcement

Hard enforcement is high-impact and requires rollback to reverse:

- **Canary abort** — stop accepting traffic to canary version
- **Pipeline termination** — forcefully terminate in-flight work
- **Rollback initiation** — revert to stable version
- **Governance escalation** — notify Budget Ledger of failure

---

## 2. Enforcement Flow

The SLO Controller follows this deterministic flow:

### Phase 1: Detection (< 20ms)

1. Scrape metrics from Prometheus
2. Evaluate latency SLOs
3. Evaluate error-rate SLOs
4. Evaluate saturation SLOs
5. Compute burn-rates (1m, 5m, 30m)

### Phase 2: Decision (< 30ms)

1. Compare burn-rates to thresholds
2. Apply precedence (1m > 5m > 30m)
3. Select enforcement action
4. Log decision event

### Phase 3: Execution (< 50ms for soft, < 100ms for hard)

1. Emit enforcement event
2. Notify Canary Gates
3. Execute action (log/throttle/abort)
4. Emit completion event

### Phase 4: Monitoring

1. Track enforcement outcome
2. Update metrics
3. Monitor for escalation
4. Prepare rollback if needed

---

## 3. Enforcement Decision Matrix

| Condition | Detection | Action | Latency |
|-----------|-----------|--------|---------|
| p99 < 120ms + error < 1% | Continuous | None | N/A |
| p99 > 120ms (30s) | Continuous | Warning | < 50ms |
| error > 1% (30s) | Continuous | Warning | < 50ms |
| saturation > 90% (any) | Per-scrape | Abort | < 50ms |
| burn_rate_30m > 3 (sustained 5m) | Per-window | Throttle | < 50ms |
| burn_rate_5m > 6 | Per-window | Abort | < 100ms |
| burn_rate_1m > 14 | Per-window | Abort | < 50ms |

---

## 4. Enforcement Actions

### Warning

Triggered when latency or error-rate exceeds SLO but burn-rate is moderate.

```json
{
  "event": "slo_warning",
  "reason": "latency_elevated",
  "latency_p99_ms": 95,
  "slo_limit_ms": 80,
  "timestamp": "2026-06-23T12:34:56Z"
}
```

**Actions:**
- Log event (structured JSON)
- Update metrics
- Notify dashboard
- **Do NOT abort** — allow pipeline to continue

### Throttle

Triggered when burn-rate is elevated over 30m window and sustained.

```json
{
  "event": "slo_throttle",
  "reason": "high_burn_rate_30m",
  "burn_rate_30m": 3.2,
  "throttle_factor": 0.5,
  "timestamp": "2026-06-23T12:34:56Z"
}
```

**Actions:**
- Reduce request throughput by 50%
- Queue excess requests
- Log throttle event
- Can be reversed if burn-rate improves
- Monitor for escalation

### Abort

Triggered when 1m or 5m burn-rate exceeds threshold.

```json
{
  "event": "slo_abort",
  "reason": "burn_rate_5m_exceeded",
  "burn_rate_5m": 7.8,
  "threshold": 6,
  "action": "canary_abort",
  "timestamp": "2026-06-23T12:34:56Z"
}
```

**Actions:**
- Emit abort signal to Canary Gates
- Freeze new requests
- Abort active pipelines (< 100ms)
- Initiate rollback (< 300ms)
- Terminal action (requires rollback to recover)

---

## 5. Enforcement Latency SLA

| Phase | Target | Hard Ceiling |
|-------|--------|--------------|
| Detection | < 20ms | 30ms |
| Decision | < 30ms | 50ms |
| Soft execution | < 50ms | 100ms |
| Hard execution (signal) | < 100ms | 200ms |
| Rollback complete | < 300ms | 500ms |

Total decision-to-abort must be < 150ms (100ms signal + 50ms latency buffer).

---

## 6. Enforcement Logging

Every enforcement action logged with full context:

```json
{
  "event": "slo_enforcement",
  "event_id": "...",
  "type": "hard|soft",
  "severity": "info|warning|critical",
  "reason": "burn_rate_5m_exceeded",
  "action": "abort",
  "metric_values": {
    "burn_rate_1m": 0.8,
    "burn_rate_5m": 7.2,
    "burn_rate_30m": 2.1,
    "latency_p99_ms": 132,
    "error_rate": 0.015
  },
  "latency_ms": 47,
  "timestamp": "2026-06-23T12:34:56Z"
}
```

---

## 7. Enforcement Idempotency

Enforcement actions must be idempotent:

- Duplicate abort signal → no-op (already aborted)
- Duplicate throttle → no-op (already throttled at 50%)
- Duplicate warning → no-op (already warned)

---

## 8. Enforcement Reversibility

| Action | Reversible | Method | Time |
|--------|-----------|--------|------|
| Warning | N/A | Info only | N/A |
| Throttle | Yes | Burn-rate improves | < 5m |
| Abort | Yes | Rollback | < 300ms |

---

## 9. Acceptance Criteria

| Criterion | Target | Tolerance |
|-----------|--------|-----------|
| Detection latency | < 20ms | ±5ms |
| Decision latency | < 30ms | ±10ms |
| Enforcement signal latency | < 100ms | ±20ms |
| Rollback completion | < 300ms | ±100ms (hard 500ms) |
| No missed violations | 0 | ±0 |
| Decision correctness | 100% | 0 errors |
| Action idempotency | 100% | 0 duplicates |
