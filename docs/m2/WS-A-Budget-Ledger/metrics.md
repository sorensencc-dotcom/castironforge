# WS-A: Budget Ledger — Metrics

The ledger must emit high‑fidelity metrics for observability and SLO enforcement.

## Core Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `ledger_writes_total` | Counter | Total ledger writes |
| `ledger_write_failures_total` | Counter | Failed writes (retries exhausted) |
| `ledger_write_latency_ms` | Histogram | Write latency (p50, p95, p99) |
| `ledger_read_latency_ms` | Histogram | Read latency (p50, p95, p99) |
| `ledger_drift_total` | Counter | Detected drift events (cumulative mismatch) |
| `budget_exhaustion_events_total` | Counter | Budget exhaustion triggers |
| `governance_abort_total` | Counter | Governance aborts emitted |
| `governance_warning_total` | Counter | Governance warnings emitted |

## Prometheus Format

```
# HELP ledger_writes_total Total ledger writes
# TYPE ledger_writes_total counter
ledger_writes_total{agent_id="agent_1"} 12345

# HELP ledger_write_failures_total Failed ledger writes
# TYPE ledger_write_failures_total counter
ledger_write_failures_total 2

# HELP ledger_write_latency_ms Write latency in milliseconds
# TYPE ledger_write_latency_ms histogram
ledger_write_latency_ms_bucket{le="10"} 8900
ledger_write_latency_ms_bucket{le="20"} 11200
ledger_write_latency_ms_bucket{le="40"} 12340
ledger_write_latency_ms_bucket{le="+Inf"} 12345
ledger_write_latency_ms_sum 98760
ledger_write_latency_ms_count 12345

# HELP ledger_read_latency_ms Read latency in milliseconds
# TYPE ledger_read_latency_ms histogram
ledger_read_latency_ms_bucket{le="5"} 9800
ledger_read_latency_ms_bucket{le="15"} 11900
ledger_read_latency_ms_bucket{le="25"} 12340
ledger_read_latency_ms_bucket{le="+Inf"} 12500
ledger_read_latency_ms_sum 45000
ledger_read_latency_ms_count 12500

# HELP ledger_drift_total Detected drift events
# TYPE ledger_drift_total counter
ledger_drift_total 0

# HELP budget_exhaustion_events_total Budget exhaustion events
# TYPE budget_exhaustion_events_total counter
budget_exhaustion_events_total{agent_id="agent_1"} 3

# HELP governance_abort_total Governance aborts
# TYPE governance_abort_total counter
governance_abort_total 3

# HELP governance_warning_total Governance warnings
# TYPE governance_warning_total counter
governance_warning_total 12
```

## Alert Conditions

| Alert | Condition | Severity |
|-------|-----------|----------|
| LedgerWriteFailures | `ledger_write_failures_total > 0` in 1m | **CRITICAL** |
| DriftDetected | `ledger_drift_total > 0` | **CRITICAL** |
| HighWriteLatency | `ledger_write_latency_p99 > 40ms` over 5m | **WARNING** |
| HighReadLatency | `ledger_read_latency_p99 > 25ms` over 5m | **WARNING** |
| BudgetExhaustion | `budget_exhaustion_events_total > 0` | **INFO** |

## SLA Targets

- Write latency p95: < 20ms
- Write latency p99: < 40ms
- Read latency p95: < 15ms
- Read latency p99: < 25ms
- Write failure rate: < 0.1%
- Drift events: 0 (no tolerance)

## Metric Scrape Configuration

- Scrape interval: 10s (for WS-B SLO calculations)
- Scrape timeout: 5s
- Endpoint: `/metrics` (standard Prometheus format)
