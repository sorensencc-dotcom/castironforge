# WS-C: Adapter Gateway Cache — Caching Strategy

The caching strategy is two‑tiered and optimized for CIC's high‑throughput, low‑latency requirements.

## 1. L1 Cache (In‑Memory)

### Characteristics

- **Latency** — < 1ms (ultra-low)
- **Scope** — Per-process (not shared)
- **Eviction** — LRU (Least Recently Used)
- **TTL** — 50-250ms (adaptive)
- **Use case** — Hot keys, repeated adapter calls

### Pros

- Fastest possible access (in-process memory)
- No network latency
- No serialization overhead

### Cons

- Not shared across CIC processes
- Duplicated entries in multi-process deployments
- Memory overhead if not carefully sized

### Implementation

```typescript
// L1 cache (in-process)
const l1 = new LRUCache({
  max: 10000,        // max entries
  maxSize: 100 * MB, // max memory
  ttl: 150,          // 150ms default
});
```

---

## 2. L2 Cache (Distributed)

### Characteristics

- **Latency** — 1-5ms (network round-trip)
- **Scope** — Shared across all CIC nodes
- **Backend** — Redis or equivalent
- **Eviction** — TTL-based (Redis default)
- **Use case** — Warm keys, cross-node consistency

### Pros

- Consistent across all CIC processes
- Shared warm cache improves hit-rate
- Survives process restarts

### Cons

- Network latency (1-5ms)
- Serialization overhead
- External dependency (Redis)

### Implementation

```typescript
// L2 cache (distributed)
const l2 = redis.createClient({
  host: 'localhost',
  port: 6379,
});

// TTL set per key (via EX or PX options)
await l2.set(key, value, 'EX', ttlSeconds);
```

---

## 3. Cache Selection Logic

Lookup follows this deterministic sequence:

### Step 1: Check L1

```typescript
const l1Hit = l1.get(key);
if (l1Hit !== undefined) {
  return l1Hit; // < 1ms
}
```

### Step 2: Check L2

```typescript
const l2Hit = await l2.get(key);
if (l2Hit !== null) {
  l1.set(key, l2Hit); // populate L1
  return l2Hit;        // 1-5ms
}
```

### Step 3: Call Upstream Adapter

```typescript
const upstreamResult = await adapter.call(params); // N ms
if (upstreamResult.error) {
  // Negative caching for known failures
  l1.set(key, { error: true }, 50); // short TTL
  return upstreamResult;
}
```

### Step 4: Write to Both Caches

```typescript
l1.set(key, upstreamResult, ttlMs);
await l2.set(key, JSON.stringify(upstreamResult), 'EX', ttlSec);
return upstreamResult;
```

---

## 4. TTL Strategy

TTL must balance freshness and stampede prevention:

| Adapter Type | Recommended TTL | Reasoning |
|--------------|-----------------|-----------|
| Stable (rarely changes) | 250ms | Higher hit-rate |
| Dynamic (updates regularly) | 100ms | Freshness + cache benefit |
| Volatile (changes constantly) | 50ms | Near-real-time |
| Frequently failed | 30ms | Minimize error caching |

### TTL Rules

- **Minimum** — 30ms (prevents excessive upstream load)
- **Maximum** — 500ms (ensures reasonable freshness)
- **Default** — 150ms
- **Error entries** — 50ms (lower TTL for failures)

### Adaptive TTL

If upstream adapter latency spikes:
- Increase TTL temporarily (up to 500ms)
- Reduce TTL back to baseline when stable
- Prevents cascading failures during degradation

---

## 5. Stampede Prevention

### Request Coalescing

When multiple requests arrive for the same uncached key before TTL:

```typescript
// First request fetches from upstream
const lock = await singleFlightLock.acquire(key);
if (lock) {
  const result = await adapter.call(params);
  singleFlightLock.release(key, result);
}

// Concurrent requests wait for first result
const result = await singleFlightLock.wait(key);
```

### Single-Flight Locks

- Only one request proceeds to upstream
- Others wait for first result
- Prevents N concurrent requests for same key
- Reduces upstream load by N×

### Backoff on Failures

If upstream fails:
- Cache failure with short TTL (50ms)
- Return cached error to subsequent requests
- Prevents continuous upstream hammering

### Negative Caching

Cache known failures:

```typescript
{
  key: "adapter:xyz",
  value: { error: "timeout", retryAfter: 5000 },
  ttl: 50  // short TTL for errors
}
```

---

## 6. Metrics Integration

Cache subsystem exports:

- `cache_hit_rate` — proportion of hits to total requests
- `cache_lookup_latency_p95` — L1 + L2 lookup time
- `cache_stampede_events_total` — count of stampede occurrences
- `cache_evictions_total` — number of LRU evictions

Exported to Prometheus for SLO monitoring.

---

## 7. Acceptance Criteria

| Criterion | Target | Tolerance |
|-----------|--------|-----------|
| Hit-rate | ≥ 85% | ±5% |
| L1 lookup latency | < 1ms | ±0.5ms |
| L2 lookup latency | < 5ms | ±1ms |
| Stampede events | 0 | ±0 |
| Stale entries beyond TTL | 0 | ±0 |
