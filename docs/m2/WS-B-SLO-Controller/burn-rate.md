# WS-B: SLO Controller — Burn-Rate

Burn‑rate is the rate at which SLOs are being consumed.
It determines whether a violation is transient or systemic.

## 1. Burn‑Rate Windows

The SLO Controller computes burn‑rate across three independent windows:

| Window | Duration | Use Case |
|--------|----------|----------|
| 1m | 1 minute | Fast detection; immediate action |
| 5m | 5 minutes | Medium detection; rolling pattern |
| 30m | 30 minutes | Slow detection; baseline trends |

Each window is independent and evaluated separately.

---

## 2. Burn‑Rate Formula

For an SLO with error budget E (the target error rate):

```
burn_rate = (observed_error_rate / E)
```

**Example:**
- Error budget E = 0.5% (1m window target)
- Observed error rate = 7%
- Burn rate = 7% / 0.5% = 14×

A 14× burn rate means errors are consuming the budget 14 times faster than expected.

---

## 3. Burn‑Rate Thresholds

Thresholds follow industry‑standard multi‑window patterns (Google SRE handbook):

| Window | Threshold | Interpretation | Action |
|--------|-----------|-----------------|--------|
| 1m | > 14× | Extremely fast burn | **Immediate abort** |
| 5m | > 6× | Fast burn | **Abort + rollback** |
| 30m | > 3× | Elevated burn | **Warning + throttle** |

### Threshold Rationale

- **1m @ 14×** — at this rate, monthly budget consumed in ~2 minutes
- **5m @ 6×** — at this rate, monthly budget consumed in ~5 days
- **30m @ 3×** — at this rate, monthly budget consumed in ~10 days (caution zone)

---

## 4. Burn‑Rate Actions

| Threshold Triggered | Action | Latency | Reversible |
|-------------------|--------|---------|-----------|
| 30m > 3× | Log warning + metrics | < 10ms | Yes |
| 30m > 3× (sustained 5m) | Throttle requests (50%) | < 50ms | Yes |
| 5m > 6× | Abort canary | < 100ms | Yes (rollback) |
| 1m > 14× | Abort canary (immediate) | < 50ms | Yes (rollback) |

### Detailed Actions

**Warning (30m > 3×)**
- Log structured event
- Update metrics
- Notify observability dashboard
- Continue accepting requests

**Throttle (30m > 3× sustained 5m)**
- Reduce throughput by 50%
- Queue excess requests
- Log throttle event
- Can be reversed if burn‑rate improves

**Abort (5m > 6× or 1m > 14×)**
- Trigger canary abort immediately
- Initiate rollback
- Freeze new requests to canary
- Terminal action (requires rollback to recover)

---

## 5. Burn‑Rate Calculation

### Step 1: Aggregate Metrics

From Prometheus (sampled every 5s):

```
total_errors_1m = sum(errors_bucket[1m])
total_requests_1m = sum(requests_bucket[1m])
error_rate_1m = total_errors_1m / total_requests_1m
```

### Step 2: Normalize Against Budget

```
burn_rate_1m = error_rate_1m / slo_target_1m
```

### Step 3: Compare Thresholds

```
if burn_rate_1m > 14:
  action = "abort"
elif burn_rate_5m > 6:
  action = "abort"
elif burn_rate_30m > 3:
  action = "warning"
else:
  action = "none"
```

### Step 4: Emit Event

```json
{
  "event": "burn_rate_violation",
  "window": "1m",
  "burn_rate": 14.2,
  "action": "abort",
  "timestamp": "2026-06-23T12:34:56Z"
}
```

---

## 6. Burn‑Rate Logging

All burn‑rate calculations logged as structured JSON:

```json
{
  "op": "burn_rate_check",
  "window": "5m",
  "error_rate": 0.031,
  "slo_target": 0.005,
  "burn_rate": 6.2,
  "action": "abort",
  "latency_ms": 12,
  "timestamp": "2026-06-23T12:34:56Z"
}
```

---

## 7. Multi‑Window Coordination

All three windows run independently and in parallel:

```
1m window: every 10s
5m window: every 30s
30m window: every 5m
```

**Decision logic:**

1. Check 1m → if > 14×, abort immediately
2. Else check 5m → if > 6×, abort
3. Else check 30m → if > 3×, warn + throttle
4. Else no action

---

## 8. Edge Cases

### Divide by Zero

If error budget = 0 (e.g., no errors expected):

```
burn_rate = 1.0 (if any error observed)
```

Triggers abort immediately.

### Very Low Traffic

If total_requests < 100 in window:

- Do not calculate burn‑rate (insufficient data)
- Log "insufficient_data" event
- Retry at next calculation window

### Transient Spikes

If 1m burn‑rate > 14× but 5m < 6×:

- Execute abort (safety first)
- Rollback on fire‑drill validates recovery

---

## 9. Acceptance Criteria

| Criterion | Target | Tolerance |
|-----------|--------|-----------|
| Burn‑rate calculation latency | < 20ms | ±5ms |
| Window independence | 100% | 0 correlation |
| Threshold accuracy | ±0.1× | ±0.05× |
| Multi‑window coordination | Correct precedence | 0 errors |
| Logging completeness | 100% of events | 0 missed |
