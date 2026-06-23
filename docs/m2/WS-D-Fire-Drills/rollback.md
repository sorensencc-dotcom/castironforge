# WS-D: Fire Drills — Rollback

Rollback validation ensures that CIC can safely revert to a known‑good state after a canary or governance failure.

## 1. Rollback Triggers

Rollback must initiate when:

- SLO burn‑rate exceeds threshold (1m, 5m, or 30m window)
- Budget exhaustion occurs (`governance_abort`)
- Adapter degradation crosses p99 latency limits
- Canary gate fails (manual or automatic)
- Health check fails for critical component

## 2. Rollback Steps

Rollback must execute in this deterministic sequence:

### Step 1: Freeze Requests (< 50ms)

Stop accepting new requests to the system being rolled back.

```json
{
  "op": "rollback_freeze",
  "component": "canary_v2",
  "timestamp": "2026-06-23T12:34:56Z"
}
```

### Step 2: Abort Active Pipelines (< 100ms)

Gracefully abort all in-flight pipelines.

```json
{
  "op": "rollback_abort_pipelines",
  "aborted_count": 23,
  "latency_ms": 87
}
```

### Step 3: Revert to Previous Stable Version (< 100ms)

Deploy the last known-good version.

```json
{
  "op": "rollback_deploy",
  "from_version": "v2.3.1-canary",
  "to_version": "v2.3.0-stable",
  "latency_ms": 45
}
```

### Step 4: Reset Caches (< 50ms)

Clear all in-memory and distributed caches.

```json
{
  "op": "rollback_cache_reset",
  "cache_entries_cleared": 15234,
  "latency_ms": 23
}
```

### Step 5: Reset SLO Counters (< 50ms)

Reset burn-rate calculations and latency histograms.

```json
{
  "op": "rollback_slo_reset",
  "burn_rate_windows_reset": 3,
  "latency_ms": 12
}
```

### Step 6: Emit Rollback Complete Event (< 50ms)

Signal that rollback is complete and system is ready.

```json
{
  "op": "rollback_complete",
  "component": "canary_v2",
  "total_rollback_latency_ms": 217,
  "status": "success"
}
```

## 3. Rollback Timing SLA

| Phase | Target | Hard Ceiling |
|-------|--------|--------------|
| Freeze Requests | < 50ms | 100ms |
| Abort Pipelines | < 100ms | 200ms |
| Deploy Stable | < 100ms | 200ms |
| Reset Caches | < 50ms | 100ms |
| Reset SLO | < 50ms | 100ms |
| Emit Complete | < 50ms | 100ms |
| **Total** | **< 300ms** | **< 500ms** |

Rollback must complete within 300ms target, with hard ceiling of 500ms.

## 4. Rollback Validation

Rollback is considered **valid** when:

### 4a. Request Handling

- ✓ No new requests processed after freeze
- ✓ No duplicate or partial processing
- ✓ All in-flight requests either completed or aborted

### 4b. Metrics Reset

- ✓ All metrics return to baseline
- ✓ No residual error rate spike
- ✓ Burn‑rate counters reset
- ✓ Latency percentiles reset

### 4c. Cache State

- ✓ No stale cache entries remain
- ✓ Cache size returns to expected minimum
- ✓ Cache hit‑rate resets to baseline

### 4d. Ledger State

- ✓ No partial ledger writes occur
- ✓ Cumulative totals consistent
- ✓ No drift detected
- ✓ Governance state cleared

### 4e. Deployment Correctness

- ✓ Stable version deployed successfully
- ✓ All health checks passing
- ✓ No deployment errors in logs

## 5. Rollback Failure Scenarios

If rollback fails:

1. **Deployment fails** → retry once, then escalate to manual intervention
2. **Cache reset fails** → continue (stale cache acceptable; will be evicted)
3. **Metrics reset fails** → continue (metrics will eventually reconcile)
4. **Freeze fails** → do not proceed; escalate

Log all rollback failures as CRITICAL.

## 6. Post-Rollback Actions

After successful rollback:

1. Emit rollback_complete event
2. Log full rollback summary
3. Notify observability dashboard
4. Trigger incident report (if governance_abort triggered)
5. Resume accepting requests

## 7. Testing

Rollback validation tests must:

- Verify each step executes in order
- Verify timing SLA met (target and ceiling)
- Verify state consistency post-rollback
- Verify idempotency (rolling back twice is safe)
- Test failure scenarios (deployment retry, cache reset failure)
