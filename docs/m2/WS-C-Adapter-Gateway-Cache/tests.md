# WS-C: Adapter Gateway Cache — Tests

The Adapter Gateway Cache requires unit, integration, and load tests.

## Unit Tests (≥ 25)

### L1 Cache Behavior (7 tests)
- LRU eviction on max capacity
- TTL expiration
- Get/set/delete operations
- Memory bounds enforcement
- Hit/miss counting
- Idempotent deletes
- Concurrent access (thread-safe)

### L2 Cache Behavior (6 tests)
- Redis connection pooling
- Get/set/del operations
- TTL enforcement
- Expiration callbacks
- Connection retry logic
- Serialization/deserialization

### Cache Key Strategy (3 tests)
- Deterministic key generation
- Key pattern matching
- Key validation
- No key collisions

### Negative Caching (2 tests)
- Error entries cached with short TTL
- Error entries expire on schedule
- Error retrieval and parsing

### Single-Flight Locks (4 tests)
- Lock acquisition
- Lock release
- Waiting on lock (coalescing)
- Lock timeout handling

### Stampede Prevention (2 tests)
- Multiple requests for same key coalesce
- Single upstream call despite N requests
- Timeout recovery

### Structured Logging (1 test)
- JSON event logging format

---

## Integration Tests (≥ 8)

### L1 → L2 Fallback

Test L1 miss → L2 hit flow:

```bash
npm run test:ws-c:integration:l1-l2-fallback
```

**Steps:**
1. Clear L1 cache
2. Add entry to L2
3. Request key
4. Verify L1 miss
5. Verify L2 hit
6. Verify L1 populated from L2

### L2 → Upstream Fallback

Test L2 miss → upstream call flow:

```bash
npm run test:ws-c:integration:l2-upstream-fallback
```

**Steps:**
1. Clear L1 and L2
2. Request key
3. Verify upstream call
4. Verify entry in L1 and L2

### Invalidation Propagation

Test L1 → L2 invalidation:

```bash
npm run test:ws-c:integration:invalidation
```

**Steps:**
1. Populate L1 and L2
2. Invalidate key
3. Verify key removed from L1
4. Verify key removed from L2

### Stampede Prevention

Test coalescing under concurrent load:

```bash
npm run test:ws-c:integration:stampede-prevention
```

**Steps:**
1. Clear caches
2. Send N concurrent requests for same key
3. Verify single upstream call
4. Verify all N requests receive result

### Adapter Degradation

Test cache behavior during upstream degradation:

```bash
npm run test:ws-c:integration:adapter-degradation
```

**Steps:**
1. Establish baseline (upstream responsive)
2. Inject degradation (slow responses)
3. Monitor cache hit-rate (should ≥ 85%)
4. Verify SLO Controller receives cache metrics
5. Verify no cascading failures

### SLO Controller Integration

Test cache metrics feed to SLO:

```bash
npm run test:ws-c:integration:slo-integration
```

**Steps:**
1. Generate load (5k req/sec)
2. Monitor cache_hit_rate metric
3. Verify metric export to Prometheus
4. Verify SLO Controller receives metric

### Event-Based Invalidation

Test invalidation triggered by events:

```bash
npm run test:ws-c:integration:event-invalidation
```

**Steps:**
1. Populate cache
2. Emit governance_abort event
3. Verify cache cleared
4. Verify invalidation logged

### Cold Start

Test pre-warming behavior:

```bash
npm run test:ws-c:integration:cold-start
```

**Steps:**
1. Clear all caches
2. Pre-warm hot keys
3. Verify warm cache populated
4. Generate load
5. Verify high hit-rate immediately

---

## Load Tests (≥ 3)

### Load Test 1: Sustained Load (5k req/sec)

```bash
npm run test:ws-c:load:sustained
```

**Configuration:**
- Duration: 60s
- Request rate: 5,000 req/sec
- Concurrency: 500
- Key cardinality: 10,000

**Expected:**
- Hit-rate ≥ 85%
- P99 latency < 15ms
- 0 stampede events
- Memory drift < 2%

### Load Test 2: Burst Load (20k req/sec)

```bash
npm run test:ws-c:load:burst
```

**Configuration:**
- Baseline: 100 req/sec
- Burst: 20,000 req/sec
- Burst duration: 5s
- Recovery window: 10s

**Expected:**
- Recovery < 10s
- No dropped requests
- No catastrophic GC
- Latency p99 returns to < 15ms

### Load Test 3: Mixed Read/Write (70/30)

```bash
npm run test:ws-c:load:mixed
```

**Configuration:**
- Total rate: 10,000 req/sec
- Read ratio: 70%
- Write ratio: 30%
- Duration: 60s

**Expected:**
- Hit-rate ≥ 80% (lower than read-only)
- Latency p99 < 20ms
- Write throughput stable
- No race conditions

---

## Scenario Tests

### Scenario 1: Adapter Latency Spike

```bash
npm run test:ws-c:scenario:latency-spike
```

**Steps:**
1. Baseline latency: 50ms
2. Inject spike: 500ms latency
3. Monitor cache absorption
4. Verify hit-rate ≥ 85%
5. Verify no cascading failure

### Scenario 2: Adapter Error Rate Spike

```bash
npm run test:ws-c:scenario:error-spike
```

**Steps:**
1. Baseline error rate: 0.1%
2. Inject spike: 20% error rate
3. Monitor negative caching
4. Verify errors cached with short TTL
5. Verify system stability

### Scenario 3: Stampede Prevention

```bash
npm run test:ws-c:scenario:stampede-prevention
```

**Steps:**
1. Clear caches
2. Send 100 concurrent requests for same uncached key
3. Monitor upstream calls (expect 1)
4. Verify all 100 receive same result
5. Verify no stampede

---

## Acceptance Criteria

| Criterion | Target | Tolerance |
|-----------|--------|-----------|
| Unit test pass rate | ≥ 98% | 2% |
| Integration test pass rate | ≥ 95% | 5% |
| Hit-rate (sustained) | ≥ 85% | ±5% |
| Latency p99 (sustained) | < 15ms | ±3ms |
| Stampede events | 0 | ±0 |
| Stale entries > TTL | 0 | ±0 |
| Load test success | 100% | 0 failures |

---

## Test Execution

```bash
# Unit tests
npm run test:ws-c:unit

# Integration tests
npm run test:ws-c:integration

# Scenario tests
npm run test:ws-c:scenarios

# Load tests
npm run test:ws-c:load

# All tests
npm run test:ws-c
```

---

## Coverage Requirements

- Line coverage: ≥ 90%
- Branch coverage: ≥ 85%
- Function coverage: ≥ 90%

---

## CI/CD Gating

WS-C tests gate M2 promotion:

1. ✓ WS-A tests pass (Budget Ledger)
2. ✓ WS-B tests pass (SLO Controller)
3. **→ Run WS-C tests (Adapter Gateway Cache)**
4. ✓ WS-C tests pass
5. ✓ WS-D tests pass (Fire Drills)
6. **→ Gate M2 promotion**
