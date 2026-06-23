# WS-C: Adapter Gateway Cache — Metrics

The cache subsystem must emit high‑fidelity metrics for observability and SLO enforcement.

## 1. Hit/Miss Metrics

### Counters

```
# HELP cache_hit_total Total cache hits (L1 or L2)
# TYPE cache_hit_total counter
cache_hit_total{layer="L1"} 45000
cache_hit_total{layer="L2"} 3500

# HELP cache_miss_total Total cache misses (required upstream call)
# TYPE cache_miss_total counter
cache_miss_total 8500

# HELP cache_evictions_total Total LRU evictions
# TYPE cache_evictions_total counter
cache_evictions_total 1200
```

### Derived Metrics

```
# HELP cache_hit_rate Cache hit rate (hits / (hits + misses))
# TYPE cache_hit_rate gauge
cache_hit_rate 0.847
```

### Performance Target

- **Hit-rate** — ≥ 85%
- Alert if hit-rate drops below 80% (warning)
- Alert if hit-rate drops below 70% (critical)

---

## 2. Latency Metrics

### Histogram

```
# HELP cache_lookup_latency_ms Cache lookup latency in milliseconds
# TYPE cache_lookup_latency_ms histogram
cache_lookup_latency_ms_bucket{le="0.5"} 34000   # L1 hits
cache_lookup_latency_ms_bucket{le="2"} 38500    # Some L1, some L2
cache_lookup_latency_ms_bucket{le="5"} 45000    # L2 hits
cache_lookup_latency_ms_bucket{le="10"} 48000   # L2 near limit
cache_lookup_latency_ms_bucket{le="100"} 52000  # Upstream calls
cache_lookup_latency_ms_bucket{le="+Inf"} 54500
cache_lookup_latency_ms_sum 234567
cache_lookup_latency_ms_count 54500
```

### Percentiles (Derived)

```
# HELP cache_lookup_latency_p50_ms Latency at 50th percentile
# TYPE cache_lookup_latency_p50_ms gauge
cache_lookup_latency_p50_ms 0.8

# HELP cache_lookup_latency_p95_ms Latency at 95th percentile
# TYPE cache_lookup_latency_p95_ms gauge
cache_lookup_latency_p95_ms 7.2

# HELP cache_lookup_latency_p99_ms Latency at 99th percentile
# TYPE cache_lookup_latency_p99_ms gauge
cache_lookup_latency_p99_ms 14.5
```

### Performance Targets

| Percentile | Target | Alert Threshold |
|------------|--------|-----------------|
| p50 | < 1ms | N/A |
| p95 | < 8ms | > 12ms (warning) |
| p99 | < 15ms | > 20ms (critical) |

---

## 3. Stampede Metrics

### Stampede Events

```
# HELP cache_stampede_events_total Total cache stampede events
# TYPE cache_stampede_events_total counter
cache_stampede_events_total 0
```

**Alert:** Any stampede event (> 0) is critical.

### Single-Flight Locks

```
# HELP cache_single_flight_locks_total Requests waiting on single-flight lock
# TYPE cache_single_flight_locks_total gauge
cache_single_flight_locks_total 3
```

**Target:** Keep locks minimal (< 10 concurrent).

---

## 4. Memory Metrics

### L1 Memory

```
# HELP cache_l1_memory_bytes L1 cache memory usage in bytes
# TYPE cache_l1_memory_bytes gauge
cache_l1_memory_bytes 52428800  # 50 MB
```

### L2 Memory

```
# HELP cache_l2_memory_bytes L2 cache memory usage in bytes (from Redis)
# TYPE cache_l2_memory_bytes gauge
cache_l2_memory_bytes 104857600  # 100 MB
```

### Eviction Rate

```
# HELP cache_evictions_per_sec Eviction rate (LRU + TTL)
# TYPE cache_evictions_per_sec gauge
cache_evictions_per_sec 0.5
```

---

## 5. Invalidation Metrics

### Invalidation Events

```
# HELP cache_invalidations_total Total cache invalidation events
# TYPE cache_invalidations_total counter
cache_invalidations_total{reason="ttl_expired"} 1200
cache_invalidations_total{reason="event_based"} 8
cache_invalidations_total{reason="pattern_match"} 2
```

### Event-Based Invalidations

```
# HELP cache_event_invalidations_total Invalidations triggered by events
# TYPE cache_event_invalidations_total counter
cache_event_invalidations_total{event="governance_abort"} 3
cache_event_invalidations_total{event="schema_change"} 1
cache_event_invalidations_total{event="canary_rollback"} 2
```

---

## 6. Prometheus Format

All metrics follow standard Prometheus text format:

```
# HELP metric_name Description
# TYPE metric_name gauge|counter|histogram
metric_name{label="value"} 12345
```

### Endpoint

```
GET /metrics/cache
```

### Scrape Configuration

```yaml
- job_name: 'adapter-gateway-cache'
  static_configs:
    - targets: ['localhost:8000']
  metrics_path: '/metrics/cache'
  scrape_interval: 5s
  scrape_timeout: 2s
```

---

## 7. Alerting Rules

Prometheus alerts:

```yaml
- alert: LowCacheHitRate
  expr: cache_hit_rate < 0.80
  for: 1m
  labels:
    severity: warning

- alert: HighCacheLatency
  expr: cache_lookup_latency_p99_ms > 20
  for: 1m
  labels:
    severity: warning

- alert: CacheStampedeEvent
  expr: cache_stampede_events_total > 0
  for: 0s
  labels:
    severity: critical

- alert: HighMemoryUsage
  expr: cache_l1_memory_bytes + cache_l2_memory_bytes > 200e6
  for: 1m
  labels:
    severity: warning
```

---

## 8. Acceptance Criteria

| Metric | Target | Tolerance |
|--------|--------|-----------|
| Hit-rate | ≥ 85% | ±5% |
| Latency p95 | < 8ms | ±2ms |
| Latency p99 | < 15ms | ±3ms |
| Stampede events | 0 | ±0 |
| Memory usage | < 200MB | ±20MB |
| Metric export latency | < 100ms | ±20ms |
