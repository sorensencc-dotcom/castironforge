# WS-C: Adapter Gateway Cache — Load Behavior

The cache must remain stable under sustained and burst load, and degrade gracefully when upstream adapters fail.

## 1. Sustained Load

### Configuration

- **Request rate:** 5,000 req/sec
- **Duration:** 60 seconds
- **Concurrency:** 500 concurrent goroutines
- **Cache key cardinality:** 10,000 unique keys

### Expected Behavior

- Hit-rate stabilizes at ≥ 85%
- P99 latency remains < 15ms
- No stampede events observed
- Memory usage stable (< 2% drift)
- CPU usage < 20% per core
- No dropped requests

### Success Criteria

| Metric | Target |
|--------|--------|
| Hit-rate | ≥ 85% |
| Latency p95 | < 8ms |
| Latency p99 | < 15ms |
| Stampede events | 0 |
| Memory drift | < 2% |
| CPU per core | < 20% |

### Validation

```bash
npm run test:ws-c:load:sustained
```

---

## 2. Burst Load

### Configuration

- **Baseline:** 100 req/sec
- **Burst rate:** 20,000 req/sec
- **Burst duration:** 5 seconds
- **Recovery window:** 10 seconds

### Expected Behavior

**During burst (0-5s):**
- Cache absorbs initial spike
- L1 hits fast (< 1ms)
- L2 queue depth increases
- P99 latency may spike to 30-50ms (acceptable)
- No cascading failures

**Recovery (5-15s):**
- Request rate returns to baseline
- Latency p99 returns to < 15ms within 10s
- Memory usage stabilizes
- No runaway GC collections

### Success Criteria

| Criterion | Target |
|-----------|--------|
| Recovery time | < 10s |
| Peak memory | < 300MB |
| No dropped requests | 100% completion |
| Catastrophic GC | None |
| L2 overload | None |
| Latency collapse | None |

### Validation

```bash
npm run test:ws-c:load:burst
```

---

## 3. Degraded Upstream Behavior

### Scenario A: Slow Upstream (10s latency)

When upstream adapter responds slowly:

```
Request flow:
1. Check L1 → miss
2. Check L2 → hit or miss
3. If miss → call upstream (10s)
4. Cache result (ttl=150ms)
5. Return to client
```

**Expected:**
- Cache absorbs subsequent requests (hit from L1/L2)
- No stampede (single-flight lock prevents N concurrent upstream calls)
- SLO Controller detects latency spike
- Canary may trigger abort if sustained

### Scenario B: Failing Upstream (50% error rate)

When upstream adapter fails intermittently:

```
Request flow:
1. Check L1 → hit (error cached with short TTL)
2. Return cached error quickly
3. Prevent continuous upstream attempts
```

**Expected:**
- Negative caching prevents hammering
- Error entries cached with 50ms TTL (short)
- SLO Controller detects error spike
- Canary may trigger abort if error-rate high

### Scenario C: Intermittent Timeouts

When upstream occasionally times out:

```
Request flow:
1. Check L1 → miss
2. Check L2 → miss
3. Call upstream → timeout
4. Cache error (negative caching)
5. Next request hits cache (no upstream call)
```

**Expected:**
- Timeouts not propagated to every request
- Error caching absorbs impact
- Load reduction from fewer upstream attempts
- Recovery once upstream recovers

### Success Criteria

| Criterion | Target |
|-----------|--------|
| Cache absorption | ≥ 85% hit-rate |
| Stampede prevention | 0 events |
| Error caching | Short TTL (50ms) |
| Latency stability | No collapse |

---

## 4. Warmup Behavior

### Cold Start (No Cache Entries)

When CIC first starts with empty caches:

```
Timeline:
0s:     First request arrives
        L1 miss → L2 miss → upstream call
        Upstream returns (N ms)
        Populate L1 + L2
        
1s:     Second request for same key
        L1 hit (< 1ms)
        
5s:     Many more requests for same/different keys
        L1 increasingly warm
        L2 has entries for all accessed keys
        Hit-rate climbing
        
30s:    Cache fully warm
        Hit-rate stabilizes at ≥ 85%
```

### Pre-Warming

To avoid thundering herd on startup:

```typescript
// Pre-warm L2 cache before accepting traffic
async function preWarmCache() {
  const hotKeys = await loadHotKeyList();
  
  for (const key of hotKeys) {
    const value = await adapter.call(key);
    await l2.set(key, value, 'EX', 150);
  }
  
  emit('cache_warmup_complete', { 
    keys_warmed: hotKeys.length 
  });
}
```

### Expected Behavior

- Pre-warm completes in < 30s
- Reduces initial hit-rate climb
- Prevents upstream overload at startup
- Hit-rate reaches 85% faster

---

## 5. Scale Testing

### 10x Increase in Load

When load increases from 5k req/sec to 50k req/sec:

**Expected:**
- Cache remains stable
- Hit-rate maintained
- Memory increases proportionally
- No resource exhaustion

### 10x Increase in Key Cardinality

When unique key count increases from 10k to 100k:

**Expected:**
- L1 LRU eviction rate increases
- L2 can absorb (up to Redis limit)
- Hit-rate may decrease (more misses due to larger working set)
- System remains operational

---

## 6. Acceptance Criteria

| Criterion | Target | Tolerance |
|-----------|--------|-----------|
| Sustained load hit-rate | ≥ 85% | ±5% |
| Sustained load p99 | < 15ms | ±3ms |
| Burst recovery time | < 10s | ±2s |
| Stampede events | 0 | ±0 |
| Memory stability | < 2% drift | ±1% |
| Graceful degradation | No collapse | Latency spike acceptable |
