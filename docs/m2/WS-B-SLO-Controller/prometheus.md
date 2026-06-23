# WS-B: SLO Controller — Prometheus Integration

The SLO Controller integrates with Prometheus for metrics ingestion, burn-rate calculation, and alerting.

## 1. Metrics Endpoint

The SLO Controller exposes:

```
GET /metrics/slo
```

### Requirements

- **Latency:** < 5ms
- **Blocking:** Never (non-blocking scrape)
- **Allocation:** Minimal (no large buffers)
- **Format:** Prometheus text format (RFC 1945)

### Endpoint Behavior

- Must respond to every scrape
- Must not drop or skip metrics
- Must use only heap-allocated buffers
- Must handle concurrent scrapes (no serialization)

---

## 2. Required Metrics

### Latency Metrics

```
# HELP slo_latency_p50_ms Latency at 50th percentile
# TYPE slo_latency_p50_ms gauge
slo_latency_p50_ms 15

# HELP slo_latency_p95_ms Latency at 95th percentile
# TYPE slo_latency_p95_ms gauge
slo_latency_p95_ms 48

# HELP slo_latency_p99_ms Latency at 99th percentile
# TYPE slo_latency_p99_ms gauge
slo_latency_p99_ms 78
```

### Error-Rate Metrics

```
# HELP slo_errors_total Total errors
# TYPE slo_errors_total counter
slo_errors_total 234

# HELP slo_requests_total Total requests
# TYPE slo_requests_total counter
slo_requests_total 45000

# HELP slo_error_rate Error rate (errors / requests)
# TYPE slo_error_rate gauge
slo_error_rate 0.0052
```

### Saturation Metrics

```
# HELP slo_cpu_usage CPU usage percentage
# TYPE slo_cpu_usage gauge
slo_cpu_usage 72.3

# HELP slo_memory_usage Memory usage percentage
# TYPE slo_memory_usage gauge
slo_memory_usage 81.5

# HELP slo_queue_depth Queue depth (jobs pending)
# TYPE slo_queue_depth gauge
slo_queue_depth 234

# HELP slo_thread_pool_usage Thread pool usage percentage
# TYPE slo_thread_pool_usage gauge
slo_thread_pool_usage 68.9
```

### Burn-Rate Metrics

```
# HELP slo_burn_rate_1m Burn rate (1-minute window)
# TYPE slo_burn_rate_1m gauge
slo_burn_rate_1m 0.8

# HELP slo_burn_rate_5m Burn rate (5-minute window)
# TYPE slo_burn_rate_5m gauge
slo_burn_rate_5m 2.1

# HELP slo_burn_rate_30m Burn rate (30-minute window)
# TYPE slo_burn_rate_30m gauge
slo_burn_rate_30m 1.2
```

### Enforcement Metrics

```
# HELP slo_enforcement_actions_total Total enforcement actions
# TYPE slo_enforcement_actions_total counter
slo_enforcement_actions_total{action="warning"} 12
slo_enforcement_actions_total{action="throttle"} 5
slo_enforcement_actions_total{action="abort"} 2
```

---

## 3. Scrape Requirements

### Scrape Configuration

```yaml
- job_name: 'slo-controller'
  static_configs:
    - targets: ['localhost:8000']
  metrics_path: '/metrics/slo'
  scrape_interval: 5s
  scrape_timeout: 2s
  honor_timestamps: false
```

### Scrape SLA

| Metric | Target | Hard Limit |
|--------|--------|-----------|
| Scrape interval | 5s | 10s |
| Scrape timeout | 2s | 5s |
| CPU per scrape | < 10ms | 20ms |
| Metrics returned | ≥ 20 | ≥ 15 |

---

## 4. Alerting Rules

Prometheus must fire alerts for SLO violations:

```yaml
groups:
  - name: slo_alerts
    interval: 30s
    rules:
      - alert: HighBurnRate1m
        expr: slo_burn_rate_1m > 14
        for: 30s
        labels:
          severity: critical
        annotations:
          summary: "Burn rate 1m > 14×"

      - alert: HighBurnRate5m
        expr: slo_burn_rate_5m > 6
        for: 1m
        labels:
          severity: warning
        annotations:
          summary: "Burn rate 5m > 6×"

      - alert: HighP99Latency
        expr: slo_latency_p99_ms > 120
        for: 1m
        labels:
          severity: warning
        annotations:
          summary: "P99 latency > 120ms"

      - alert: HighErrorRate
        expr: slo_error_rate > 0.01
        for: 1m
        labels:
          severity: warning
        annotations:
          summary: "Error rate > 1%"

      - alert: HighSaturation
        expr: slo_cpu_usage > 90 or slo_memory_usage > 95
        for: 30s
        labels:
          severity: critical
        annotations:
          summary: "Saturation limit exceeded"
```

---

## 5. Metric Retention

| Metric | Retention | Scrape Resolution |
|--------|-----------|-------------------|
| Latency percentiles | 24h | 5s |
| Error-rate | 24h | 5s |
| Burn-rate | 24h | 5s |
| Saturation | 24h | 5s |
| Enforcement actions | 30d | 1m |

---

## 6. Dashboard Integration

Prometheus dashboards should display:

- **Latency trend** — p50, p95, p99 over time
- **Error-rate trend** — error rate with SLO target line
- **Burn-rate graph** — all three windows with threshold lines
- **Saturation trend** — CPU, memory, queue, thread pool
- **Enforcement events** — timeline of warnings, aborts
- **SLO status** — green/red indicator

---

## 7. Acceptance Criteria

| Criterion | Target | Tolerance |
|-----------|--------|-----------|
| Scrape success rate | ≥ 99.9% | 0.1% |
| Metric completeness | 100% | 0 missing |
| Scrape latency | < 2s | ±0.5s |
| CPU per scrape | < 10ms | ±5ms |
| Alert firing latency | < 1m | ±10s |
| No metric drift | 0 | ±0 |
