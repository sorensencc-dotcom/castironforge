# CIC Routing Telemetry Schema v2.3
# v2.3.0 | 2026-05-30
# Purpose: Make routing behavior observable, tunable, and auditable.

## 1. Event Names (Canonical)

CIC emits **five routing events**, always in this order:

1. `routing.start`
2. `routing.local.attempt`
3. `routing.cloud.attempt`
4. `routing.fallback.trigger`
5. `routing.decision.final`

Not all events fire every time — but **routing.start** and **routing.decision.final** always do.

---

## 2. Event: `routing.start`

Emitted at the moment a subsystem requests routing.

```json
{
  "event": "routing.start",
  "task_id": "string",
  "subsystem": "DISCOVERY | HARVESTER | ...",
  "entropy_score": 0.0,
  "drift_score": 0.0,
  "context_tokens": 1234,
  "safety_level": "LOW | MEDIUM | HIGH",
  "latency_budget_ms": 500,
  "token_budget_mode": "NORMAL | CONSERVE | AGGRESSIVE_LOCAL",
  "timestamp": "ISO-8601"
}
```

---

## 3. Event: `routing.local.attempt`

Emitted when RouterAgent selects a local path (L0/L1) or local fallback.

```json
{
  "event": "routing.local.attempt",
  "task_id": "string",
  "routing_class": "L0 | L1 | F",
  "local_latency_p95": 120,
  "local_available": true,
  "reason": "ENTROPY | COST | LATENCY | DRIFT",
  "timestamp": "ISO-8601"
}
```

---

## 4. Event: `routing.cloud.attempt`

Emitted when RouterAgent selects a cloud path (C1/C2).

```json
{
  "event": "routing.cloud.attempt",
  "task_id": "string",
  "routing_class": "C1 | C2",
  "cloud_latency_p95": 340,
  "cloud_flash_available": true,
  "cloud_pro_available": true,
  "reason": "ENTROPY | SAFETY | LATENCY",
  "timestamp": "ISO-8601"
}
```

---

## 5. Event: `routing.fallback.trigger`

Emitted when cloud inference is rejected due to drift, latency, or low confidence.

```json
{
  "event": "routing.fallback.trigger",
  "task_id": "string",
  "trigger": "DRIFT | LATENCY | LOW_CONFIDENCE | MODEL_UNAVAILABLE",
  "drift_score": 0.52,
  "cloud_latency_p95": 900,
  "timestamp": "ISO-8601"
}
```

---

## 6. Event: `routing.decision.final`

The authoritative record of the routing outcome.

```json
{
  "event": "routing.decision.final",
  "task_id": "string",
  "subsystem": "HARVESTER",
  "routing_class": "L0 | L1 | C1 | C2 | F",
  "target": "LOCAL | CLOUD_FLASH | CLOUD_PRO | LOCAL_FALLBACK",
  "reason": "ENTROPY | SAFETY | LATENCY | COST | DRIFT | FALLBACK",
  "confidence_threshold": 0.92,
  "latency_budget_ms": 500,
  "tokens_saved_estimate": 3400,
  "timestamp": "ISO-8601"
}
```

---

## 7. Dashboard Integration Contract

Your Observability Dashboard must support:

### A. Routing Heatmap
- X‑axis: entropy score  
- Y‑axis: routing class  
- Color: frequency  

### B. Drift Spike Detector
- drift_score > 0.35  
- fallback events per minute  
- subsystem correlation  

### C. Latency Curves
- local p95  
- cloud‑flash p95  
- cloud‑pro p95  
- SLA violations  

### D. Token‑Economy Savings
- tokens saved per task  
- tokens saved per subsystem  
- tokens saved per hour/day  

### E. Routing Stability Index
A single metric:
`RSI = 1 - (fallback_rate + drift_rate + latency_violation_rate)`

---

## 8. Emission Rules (Hard Requirements)

- Every routing decision MUST emit `routing.start` and `routing.decision.final`.
- Local attempts MUST emit `routing.local.attempt`.
- Cloud attempts MUST emit `routing.cloud.attempt`.
- Any fallback MUST emit `routing.fallback.trigger`.
- All timestamps MUST be ISO‑8601.
- All events MUST be JSON‑serializable.
- No event may contain model outputs or user data.
