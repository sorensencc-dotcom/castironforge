# WS-A: Budget Ledger — Governance Hooks

Governance hooks enforce budget‑related safety and abort conditions.

## 1. Budget Exhaustion

### Trigger Conditions

- `cumulative_tokens > max_tokens`
- `cumulative_cost_usd > max_cost`
- `projected_cost_usd > projected_max`

### Actions

- Emit `governance_abort` event
- Notify SLO Controller immediately
- Abort active pipeline (propagate to Adapter Gateway)
- Stop accepting new budget writes for this session

### Event Payload

```json
{
  "event": "governance_abort",
  "reason": "budget_exhaustion",
  "agent_id": "...",
  "session_id": "...",
  "cumulative_tokens": 50000,
  "max_tokens": 50000,
  "cumulative_cost_usd": 15.00,
  "max_cost_usd": 15.00,
  "projected_cost_usd": 20.50,
  "timestamp": "2026-06-23T12:34:56Z"
}
```

## 2. Threshold Warnings

### Trigger Conditions

- `projected_cost_usd > warning_threshold` (e.g., 80% of budget)
- `tokens_used_in_last_1m > burst_limit`
- `cumulative_cost_usd > caution_threshold` (e.g., 70% of budget)

### Actions

- Emit `governance_warning` event
- Log structured event
- Notify observability dashboard
- **Do NOT abort** — allow pipeline to continue

### Event Payload

```json
{
  "event": "governance_warning",
  "reason": "approaching_budget_limit",
  "agent_id": "...",
  "session_id": "...",
  "cumulative_cost_usd": 12.00,
  "max_cost_usd": 15.00,
  "percent_consumed": 80.0,
  "timestamp": "2026-06-23T12:34:56Z"
}
```

## 3. Integration Points

### SLO Controller

- Receives `governance_abort` events
- Updates SLO violation count
- May trigger canary gate rollback

### Canary Gates

- Reads governance state via ledger read‑path
- Aborts canary if budget exhausted
- Used in fire‑drill validation

### Fire‑Drill Harness

- Simulates budget exhaustion
- Validates governance_abort propagation
- Tests abort handling in all downstream systems

### Observability Dashboard

- Displays governance_warning count
- Displays governance_abort count
- Shows budget consumption trend

## 4. Logging

Each governance event is logged as a separate, structured entry:

```json
{
  "event": "governance_abort",
  "event_id": "...",
  "reason": "budget_exhaustion",
  "agent_id": "...",
  "session_id": "...",
  "cumulative_cost_usd": 15.00,
  "timestamp": "2026-06-23T12:34:56Z",
  "propagated_to": ["slo_controller", "canary_gates"]
}
```

Logged to structured log sink (stdout + observability backend).

## 5. SLA

- Governance event latency: < 10ms (from trigger to propagation)
- No missed events
- 100% reliability (governance events are critical)
