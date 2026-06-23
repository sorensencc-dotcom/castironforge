# WS-B: SLO Controller — Canary Integration

The SLO Controller is the primary decision engine for canary gating and rollback.

## 1. Integration Architecture

### Signal Flow

```
Prometheus
  ↓
SLO Controller
  ├→ Evaluate SLOs (latency, error-rate, saturation)
  ├→ Compute burn-rates (1m, 5m, 30m)
  ├→ Decide enforcement action
  └→ Notify Canary Gates

Canary Gates
  ├→ Receive abort signal
  ├→ Freeze new traffic
  ├→ Abort in-flight pipelines
  └→ Initiate rollback
```

---

## 2. Canary Abort Conditions

Canary abort is triggered when:

| Condition | Window | Threshold | Action |
|-----------|--------|-----------|--------|
| Burn-rate 1m | 1m | > 14× | Abort immediately |
| Burn-rate 5m | 5m | > 6× | Abort immediately |
| P99 latency | 1m | > 120ms | Abort if sustained 30s |
| Error-rate | 1m | > 1% | Abort if sustained 30s |
| Saturation | Real-time | > 90% | Abort immediately |

### Abort Signal

```json
{
  "op": "canary_abort",
  "signal_type": "slo_violation",
  "reason": "burn_rate_5m_exceeded",
  "canary_version": "v2.3.1-canary",
  "burn_rate_5m": 7.2,
  "threshold": 6,
  "timestamp": "2026-06-23T12:34:56Z",
  "latency_ms": 47
}
```

---

## 3. Canary Rollback Execution

When abort signal received, Canary Gates must:

### Step 1: Freeze Requests (< 50ms)

Stop accepting new requests to canary version.

```json
{
  "step": "freeze",
  "canary_version": "v2.3.1-canary",
  "timestamp": "2026-06-23T12:34:56.000Z"
}
```

### Step 2: Abort Active Pipelines (< 100ms)

Gracefully terminate in-flight work.

```json
{
  "step": "abort_pipelines",
  "pipelines_aborted": 23,
  "latency_ms": 87,
  "timestamp": "2026-06-23T12:34:56.087Z"
}
```

### Step 3: Deploy Stable Version (< 100ms)

Revert to last known-good version.

```json
{
  "step": "deploy",
  "from_version": "v2.3.1-canary",
  "to_version": "v2.3.0-stable",
  "latency_ms": 45,
  "timestamp": "2026-06-23T12:34:56.132Z"
}
```

### Step 4: Reset SLO Counters (< 50ms)

Clear burn-rate and latency histograms.

```json
{
  "step": "reset_slo",
  "metrics_reset": ["burn_rate_1m", "burn_rate_5m", "latency_p95", "latency_p99"],
  "latency_ms": 12,
  "timestamp": "2026-06-23T12:34:56.144Z"
}
```

### Step 5: Emit Rollback Complete (< 50ms)

Signal that rollback finished and system is ready.

```json
{
  "step": "rollback_complete",
  "total_rollback_latency_ms": 194,
  "status": "success",
  "timestamp": "2026-06-23T12:34:56.194Z"
}
```

---

## 4. Canary Metrics Feed

The SLO Controller provides real-time metrics to Canary Gates:

### Latency Feed

```json
{
  "feed": "latency",
  "p50_ms": 18,
  "p95_ms": 52,
  "p99_ms": 92,
  "timestamp": "2026-06-23T12:34:56Z"
}
```

Updated every 5s from Prometheus scrape.

### Error-Rate Feed

```json
{
  "feed": "error_rate",
  "errors_total": 234,
  "requests_total": 45000,
  "rate": 0.0052,
  "timestamp": "2026-06-23T12:34:56Z"
}
```

Updated every 5s.

### Burn-Rate Feed

```json
{
  "feed": "burn_rate",
  "burn_rate_1m": 0.8,
  "burn_rate_5m": 2.1,
  "burn_rate_30m": 1.2,
  "timestamp": "2026-06-23T12:34:56Z"
}
```

Updated every window (1m, 5m, 30m respectively).

### Saturation Feed

```json
{
  "feed": "saturation",
  "cpu_usage": 72.3,
  "memory_usage": 81.5,
  "queue_depth": 234,
  "thread_pool_usage": 68.9,
  "timestamp": "2026-06-23T12:34:56Z"
}
```

Updated every 10s from system monitoring.

---

## 5. Canary Warmup

Before canary promotion, SLO Controller must validate:

### Warmup Criteria

- P95 latency baseline established (30s)
- Error-rate baseline established (30s)
- Saturation levels acceptable (< 80%)
- No burn-rate spikes in 5m window
- Metrics stable (< 5% variance)

### Warmup Signal

```json
{
  "op": "canary_warmup_complete",
  "canary_version": "v2.3.1-canary",
  "metrics": {
    "latency_p95_ms": 48,
    "error_rate": 0.0048,
    "saturation_max": 0.72
  },
  "ready_for_promotion": true,
  "timestamp": "2026-06-23T12:34:56Z"
}
```

---

## 6. Integration Testing

Canary + SLO Controller integration tests must verify:

| Test | Condition | Expected |
|------|-----------|----------|
| Abort signal receives | Burn-rate 5m > 6 | Abort < 100ms |
| Rollback executes | Abort signal received | Rollback < 300ms |
| Metrics reset | Rollback complete | All metrics baseline |
| SLO recalculation | Rollback complete | Burn-rate reset |
| No cascading | Abort signal sent | No secondary failures |

---

## 7. Acceptance Criteria

| Criterion | Target | Tolerance |
|-----------|--------|-----------|
| Abort signal latency | < 100ms | ±20ms |
| Rollback initiation | < 50ms of signal | ±20ms |
| Rollback completion | < 300ms | ±100ms (hard 500ms) |
| Metrics reset accuracy | 100% | 0 drift |
| Canary warmup time | 30-60s | ±10s |
| No missed abort conditions | 0 | ±0 |
