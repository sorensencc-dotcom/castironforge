# WS-C: Adapter Gateway Cache — Invalidation

Cache invalidation ensures correctness and freshness across L1 and L2.

## 1. Time‑Based Invalidation

TTL expiration removes stale entries automatically.

### L1 Invalidation

LRU cache automatically expires entries at TTL boundary:

```typescript
const l1 = new LRUCache({
  ttl: 150, // 150ms
});

// Entry automatically removed after 150ms
const value = l1.get(key); // undefined after TTL
```

### L2 Invalidation

Redis automatically expires entries via EXPIRE command:

```typescript
// Set with 2-second TTL (2000ms = 2s)
await l2.set(key, value, 'EX', 2);

// Redis removes key after 2s
```

### No Action Required

- Entries expire passively at TTL boundary
- No explicit invalidation calls needed
- Automatic background expiration

---

## 2. Event‑Based Invalidation

Triggered when specific events occur:

### Event 1: Upstream Adapter Emits Update

If upstream adapter notifies that data changed:

```json
{
  "event": "adapter_update",
  "key_pattern": "adapter:xyz:*",
  "timestamp": "2026-06-23T12:34:56Z"
}
```

**Action:** Invalidate matching keys from L1 and L2.

### Event 2: Schema Version Changes

If CIC schema version increments:

```json
{
  "event": "schema_version_changed",
  "old_version": 1,
  "new_version": 2,
  "timestamp": "2026-06-23T12:34:56Z"
}
```

**Action:** Clear entire cache (all entries invalid under new schema).

### Event 3: Governance Hook Triggers Abort

When Budget Ledger emits `governance_abort`:

```json
{
  "event": "governance_abort",
  "reason": "budget_exhaustion",
  "timestamp": "2026-06-23T12:34:56Z"
}
```

**Action:** Clear all cache entries for aborted session.

### Event 4: Canary Rollback

When canary rollback completes:

```json
{
  "event": "canary_rollback_complete",
  "from_version": "v2.3.1-canary",
  "to_version": "v2.3.0-stable",
  "timestamp": "2026-06-23T12:34:56Z"
}
```

**Action:** Clear cache entries generated during canary.

---

## 3. Dependency‑Based Invalidation

Some cache keys depend on external state:

### Ledger Dependencies

Cache key format: `adapter:xyz:ledger:{ledger_id}`

If ledger state changes → invalidate all keys with that ledger_id.

### SLO Dependencies

Cache key format: `adapter:xyz:slo:{slo_level}`

If SLO level changes (e.g., from "stable" to "degraded") → invalidate.

### Adapter Health Dependencies

Cache key format: `adapter:xyz:health:{health_status}`

If adapter health status changes → invalidate.

---

## 4. Invalidation Rules

### Rule 1: L1 → L2 Propagation

When invalidating a key:

1. Remove from L1 immediately (< 1ms)
2. Remove from L2 immediately (< 5ms)
3. Ensure L1 and L2 are consistent

### Rule 2: L2 → All Nodes Propagation

When a single CIC node invalidates in L2:

- All nodes see the invalidation (Redis is source of truth)
- No stale entries served from any node

### Rule 3: No Stale Entries Beyond TTL

- Entries must expire by TTL deadline
- No explicit invalidation needed for time-based expiry
- Background expiration must complete before TTL boundary

### Rule 4: No Partial Invalidation

- Either invalidate entire key or none
- No half-invalidated state (L1 invalid, L2 valid)
- Atomic operations required

---

## 5. Invalidation Implementation

### Explicit Invalidation

```typescript
// Invalidate single key
async function invalidateKey(key: string) {
  l1.delete(key);                    // L1
  await l2.del(key);                 // L2
  
  emit('cache_invalidate', { key }); // log event
}

// Invalidate pattern
async function invalidatePattern(pattern: string) {
  const keys = await l2.keys(pattern);
  
  for (const key of keys) {
    l1.delete(key);
    await l2.del(key);
  }
  
  emit('cache_invalidate', { pattern, count: keys.length });
}
```

### Event-Driven Invalidation

```typescript
// Listen for adapter updates
ledger.on('governance_abort', async (event) => {
  // Clear all cache entries
  l1.clear();
  await l2.flushdb();
  
  emit('cache_invalidate', { 
    reason: 'governance_abort',
    event_id: event.id
  });
});
```

---

## 6. Invalidation Logging

All invalidation events logged:

```json
{
  "event": "cache_invalidate",
  "key": "adapter:xyz:123",
  "reason": "ttl_expired|event_based|pattern_match",
  "layers": ["L1", "L2"],
  "timestamp": "2026-06-23T12:34:56Z",
  "latency_ms": 2
}
```

---

## 7. Validation

### Stale Entry Detection

After invalidation, verify no stale entries:

```typescript
// Post-invalidation check
const l1Stale = l1.has(invalidatedKey);
const l2Stale = await l2.exists(invalidatedKey);

if (l1Stale || l2Stale) {
  emit('cache_invalidation_failure', {
    key: invalidatedKey,
    l1_stale: l1Stale,
    l2_stale: l2Stale
  });
}
```

---

## 8. Acceptance Criteria

| Criterion | Target | Tolerance |
|-----------|--------|-----------|
| Time-based expiry | ≤ TTL boundary | ±10ms |
| Event-based invalidation latency | < 100ms | ±20ms |
| L1 ↔ L2 consistency | 100% | 0 divergence |
| No stale entries beyond TTL | 0 | ±0 |
| Invalidation atomicity | 100% | 0 partial states |
