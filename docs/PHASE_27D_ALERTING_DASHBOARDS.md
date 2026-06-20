# Phase 27d: Alerting & Dashboards

**Date:** 2026-06-20  
**Status:** Implementation Complete  
**Branch:** `claude/opensharing-omnigent-dbrx-bnyfjq`  
**Depends on:** Phase 27a (Performance Metrics)

## Overview

Phase 27d adds **real-time alerting** and **Prometheus metrics export** to CIC's monitoring. The system now continuously monitors agent performance against threshold-based rules and fires alerts when issues are detected. Metrics are exported in Prometheus format for integration with Grafana, Prometheus, or other monitoring stacks.

## Problem Solved

Without alerting and visibility:
- Operator must manually check metrics via API
- Degraded performance goes undetected for hours
- No centralized dashboard view of all agents
- Can't integrate with existing monitoring infrastructure

**Solution:** AlertingSystem monitors metrics in real-time, fires alerts on threshold violations, and exports metrics in standard Prometheus format.

## New Files

### `chat-agent/src/utils/alertingSystem.ts` (300+ lines)

**AlertingSystem class:**

```typescript
export class AlertingSystem {
  start(): void
  stop(): void
  getAlerts(limit?, severity?): Alert[]
  clearOldAlerts(olderThanMs): number
  fireAlert(alert): void
  getStats(): { totalAlerts, criticalCount, warningCount, infoCount, alertsByType }
}
```

**Data Structures:**

```typescript
export interface Alert {
  id: string;
  timestamp: number;
  severity: 'info' | 'warning' | 'critical';
  agentRole?: AgentRole;
  type: AlertType;
  message: string;
  value?: number;
  threshold?: number;
  metadata?: Record<string, any>;
}

export type AlertType =
  | 'low_success_rate'
  | 'high_failure_rate'
  | 'high_latency'
  | 'high_cost'
  | 'no_executions'
  | 'high_timeout_rate'
  | 'cascading_failure';

export interface AlertConfig {
  lowSuccessRateThreshold?: number;        // Default: 70%
  highFailureRateThreshold?: number;       // Default: 30%
  highLatencyThreshold?: number;           // Default: 5000ms
  highCostThreshold?: number;              // Default: $1.00
  highTimeoutRateThreshold?: number;       // Default: 15%
  cascadingFailureThreshold?: number;      // Default: 3+ agents
  checkIntervalMs?: number;                // Default: 30s
}
```

**Alert Rules:**

| Rule | Severity | Condition | Default |
|------|----------|-----------|---------|
| `low_success_rate` | warning | successRate < 70% | Enabled |
| `high_failure_rate` | critical | failureRate > 30% | Enabled |
| `high_latency` | warning | avgDuration > 5000ms | Enabled |
| `high_cost` | info | avgCost > $1.00 | Enabled |
| `high_timeout_rate` | critical | timeoutRate > 15% | Enabled |
| `no_executions` | info | totalExecutions == 0 | Enabled |
| `cascading_failure` | critical | 3+ agents below 70% success | Enabled |

### `chat-agent/src/utils/prometheusExporter.ts` (250+ lines)

**Export functions:**

```typescript
export function exportPrometheusMetrics(): string
export function getGrafanaDashboard(): Record<string, any>
```

**Prometheus Metrics Exported:**

Per-agent metrics (with `agent` label):
```
cic_agent_executions_total
cic_agent_success_total
cic_agent_failure_total
cic_agent_timeout_total
cic_agent_rejection_total
cic_agent_duration_ms_total
cic_agent_tokens_total
cic_agent_cost_usd_total
cic_agent_success_rate
cic_agent_failure_rate
cic_agent_timeout_rate
cic_agent_rejection_rate
cic_agent_avg_duration_ms
cic_agent_avg_tokens
cic_agent_avg_cost_usd
cic_agent_last_execution
```

Global metrics:
```
cic_total_executions
cic_success_rate
cic_avg_duration_ms
cic_avg_cost_usd
cic_total_cost_usd
cic_alerts_total
cic_alerts_critical
cic_alerts_warning
cic_alerts_info
```

## Modified Files

### `chat-agent/src/server.ts`

- Import alerting system initialization
- Initialize on startup with configurable thresholds
- Log endpoints for metrics and alerts

```typescript
import { initializeAlertingSystem } from './utils/alertingSystem';

async function start() {
  initializeAlertingSystem({
    lowSuccessRateThreshold: 70,
    highFailureRateThreshold: 30,
    highLatencyThreshold: 5000,
    highCostThreshold: 1.0,
    checkIntervalMs: 30000
  });
  // ... rest of startup
}
```

### `chat-agent/src/router/orchestrationRouter.ts`

- Import alerting system and exporters
- Add 3 new endpoints:
  - `GET /alerts` — Get active alerts (with filtering)
  - `GET /metrics/prometheus` — Prometheus metrics export
  - `GET /dashboards/grafana` — Grafana dashboard definition

## API Endpoints

### 1. Get Active Alerts

```bash
curl 'http://localhost:8000/orchestration/alerts?limit=50&severity=critical'

# Response
{
  "alerts": [
    {
      "id": "alert-1719018000000-0.123",
      "timestamp": 1719018000000,
      "severity": "critical",
      "agentRole": "harvester",
      "type": "high_failure_rate",
      "message": "Agent harvester has high failure rate: 35.2%",
      "value": 35.2,
      "threshold": 30,
      "metadata": { "metrics": {...} }
    },
    {
      "id": "alert-1719017970000-0.456",
      "timestamp": 1719017970000,
      "severity": "warning",
      "agentRole": "enricher",
      "type": "high_latency",
      "message": "Agent enricher has high latency: 5678ms",
      "value": 5678,
      "threshold": 5000,
      "metadata": {...}
    }
  ],
  "stats": {
    "totalAlerts": 47,
    "criticalCount": 3,
    "warningCount": 12,
    "infoCount": 32,
    "alertsByType": {
      "high_failure_rate": 2,
      "high_latency": 5,
      "low_success_rate": 8,
      ...
    }
  }
}
```

**Query Parameters:**
- `limit` — Max alerts to return (default: 100)
- `severity` — Filter by severity: info/warning/critical (optional)

### 2. Prometheus Metrics Export

```bash
curl http://localhost:8000/orchestration/metrics/prometheus

# Response (text/plain)
# HELP cic_agent_executions_total Total number of task executions
# TYPE cic_agent_executions_total counter
cic_agent_executions_total{agent="harvester"} 125
cic_agent_executions_total{agent="enricher"} 87

# HELP cic_agent_success_rate Percentage of successful executions
# TYPE cic_agent_success_rate gauge
cic_agent_success_rate{agent="harvester"} 94.40
cic_agent_success_rate{agent="enricher"} 96.55

# HELP cic_total_executions Total executions across all agents
# TYPE cic_total_executions gauge
cic_total_executions 312
cic_success_rate 95.19
cic_total_cost_usd 25.48
...
```

### 3. Grafana Dashboard Definition

```bash
curl http://localhost:8000/orchestration/dashboards/grafana | jq .

# Response (Grafana JSON model)
{
  "dashboard": {
    "title": "CIC Agent Performance",
    "description": "Real-time monitoring of agent performance metrics",
    "tags": ["cic", "agents", "orchestration"],
    "schemaVersion": 30,
    "panels": [
      {
        "title": "Success Rate by Agent",
        "type": "graph",
        "targets": [
          {
            "expr": "cic_agent_success_rate",
            "legendFormat": "{{agent}}"
          }
        ],
        "gridPos": { "h": 8, "w": 12, "x": 0, "y": 0 }
      },
      ...
    ]
  }
}
```

## Use Cases

### 1. Real-Time Alerting

Monitor agent health and respond to issues:

```bash
# Poll alerts every 30 seconds
while true; do
  curl -s 'http://localhost:8000/orchestration/alerts?severity=critical' | \
    jq '.alerts[] | "\(.agentRole): \(.message)"'
  sleep 30
done

# Output:
# harvester: Agent harvester has high failure rate: 35.2%
# enricher: Agent enricher has high latency: 5678ms
```

### 2. Prometheus Integration

Scrape metrics from CIC for long-term storage:

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'cic-agent'
    static_configs:
      - targets: ['localhost:8000']
    metrics_path: '/orchestration/metrics/prometheus'
    scrape_interval: 30s
```

### 3. Grafana Dashboard

Import dashboard and visualize agent performance:

```bash
# Export dashboard as JSON
curl http://localhost:8000/orchestration/dashboards/grafana > dashboard.json

# In Grafana UI:
# - Create new Prometheus data source pointing to http://localhost:9090
# - Import dashboard.json
# - View real-time agent metrics
```

### 4. Alert Aggregation

Send alerts to Slack or PagerDuty:

```bash
#!/bin/bash
# alert_webhook.sh

while true; do
  curl -s 'http://localhost:8000/orchestration/alerts?severity=critical' | \
    jq -r '.alerts[] | select(.severity == "critical") | .message' | \
    while read msg; do
      curl -X POST https://hooks.slack.com/services/YOUR/WEBHOOK \
        -d "{\"text\": \"🚨 CIC Alert: $msg\"}"
    done
  sleep 30
done
```

## Alert Examples

### Alert 1: High Failure Rate

```json
{
  "id": "alert-1719018000000-0.123",
  "timestamp": 1719018000000,
  "severity": "critical",
  "agentRole": "harvester",
  "type": "high_failure_rate",
  "message": "Agent harvester has high failure rate: 35.2%",
  "value": 35.2,
  "threshold": 30,
  "metadata": {
    "metrics": {
      "agentRole": "harvester",
      "successRate": 64.8,
      "failureRate": 35.2,
      "totalExecutions": 125,
      "totalFailures": 44
    }
  }
}
```

**Action:** Investigate root cause, possibly degrade traffic to harvester.

### Alert 2: Cascading Failure

```json
{
  "id": "alert-1719018030000-0.789",
  "timestamp": 1719018030000,
  "severity": "critical",
  "type": "cascading_failure",
  "message": "Multiple agents below 70% success rate",
  "metadata": {
    "allMetrics": [
      { "agentRole": "harvester", "successRate": 65.0 },
      { "agentRole": "enricher", "successRate": 68.5 },
      { "agentRole": "evaluator", "successRate": 69.9 }
    ]
  }
}
```

**Action:** System-wide issue; check logs, consider circuit breaker or degraded mode.

### Alert 3: High Cost

```json
{
  "id": "alert-1719017970000-0.456",
  "timestamp": 1719017970000,
  "severity": "info",
  "agentRole": "enricher",
  "type": "high_cost",
  "message": "Agent enricher has high average cost: $1.25",
  "value": 1.25,
  "threshold": 1.0
}
```

**Action:** Consider routing to cheaper agent or optimizing model usage.

## Monitoring & Observability

### Check alert statistics:

```bash
curl 'http://localhost:8000/orchestration/alerts' | jq '.stats'

# Output:
{
  "totalAlerts": 47,
  "criticalCount": 3,
  "warningCount": 12,
  "infoCount": 32,
  "alertsByType": {
    "high_failure_rate": 2,
    "high_latency": 5,
    "low_success_rate": 8,
    "high_cost": 17
  }
}
```

### View only critical alerts:

```bash
curl 'http://localhost:8000/orchestration/alerts?severity=critical' | jq '.alerts'
```

### Export to file for analysis:

```bash
curl 'http://localhost:8000/orchestration/metrics/prometheus' > metrics.txt
```

## Configuration

### Adjustment: Alert Thresholds

```typescript
initializeAlertingSystem({
  lowSuccessRateThreshold: 80,      // Stricter: 80% instead of 70%
  highFailureRateThreshold: 20,     // Lower tolerance: 20% instead of 30%
  highLatencyThreshold: 3000,       // Faster target: 3s instead of 5s
  highCostThreshold: 0.5,           // Tighter budget: $0.50 instead of $1.00
  checkIntervalMs: 15000            // Check every 15s instead of 30s
});
```

### Adjustment: Alert Frequency (Debounce)

Alerts for the same rule/agent are debounced: only fire if >60 seconds since last alert of same type.

```typescript
// In alertingSystem.ts, line ~130
const lastTime = this.lastAlertTime.get(key) ?? 0;
if (now - lastTime < 60000) {  // ← Adjust this window
  return;
}
```

## Performance Impact

- **CPU:** <1ms per rule check, <10ms per alert check interval
- **Memory:** ~500B per alert; typical 1000 alerts (~500KB)
- **Network:** Metrics export ~5KB per request (compressible)
- **Disk:** None (in-memory storage only)

## Alert Retention

- **Default:** Last 1000 alerts (in-memory)
- **Retention:** Indefinite (or manual cleanup via operator)

Clear old alerts:

```typescript
const alerting = getAlertingSystem();
const deleted = alerting.clearOldAlerts(24 * 60 * 60 * 1000);  // Delete 24h+ old
console.log(`Deleted ${deleted} old alerts`);
```

## Testing

### Type Check

```bash
cd chat-agent
./node_modules/.bin/tsc --noEmit
```

### Manual Test

```bash
# 1. Start server
npm run dev

# 2. Execute tasks to generate metrics
for i in {1..10}; do
  curl -X POST http://localhost:8000/orchestration/tasks \
    -H "Content-Type: application/json" \
    -d '{"sessionId":"test","agent":"harvester","instruction":"Count to 5"}' &
done
wait

# 3. Check alerts
curl 'http://localhost:8000/orchestration/alerts' | jq .

# 4. Export Prometheus metrics
curl http://localhost:8000/orchestration/metrics/prometheus | head -30

# 5. Get Grafana dashboard
curl http://localhost:8000/orchestration/dashboards/grafana | jq '.dashboard.panels | length'
```

## Grafana Integration

### Step 1: Create Prometheus Data Source

In Grafana UI:
1. Configuration → Data Sources
2. Add new Prometheus data source
3. Set URL to http://prometheus:9090 (or wherever Prometheus runs)
4. Save & test

### Step 2: Import Dashboard

```bash
# Get dashboard JSON
curl http://localhost:8000/orchestration/dashboards/grafana > dashboard.json

# In Grafana UI:
# 1. Dashboards → Import
# 2. Upload JSON
# 3. Select Prometheus data source
# 4. Import
```

### Step 3: View Dashboards

Panels included:
- Success Rate by Agent (graph)
- Average Duration by Agent (graph)
- Average Cost by Agent (graph)
- Failure Rate by Agent (graph)
- Overall Success Rate (stat)
- Total Cost (stat)
- Active Alerts (stat)
- Critical Alerts (stat)

## Next Steps (Phase 27d+)

### 1. Persistent Alert Storage (Phase 27e)

Store alerts to database for historical tracking:

```typescript
export class AlertDatabase {
  async saveAlert(alert: Alert): Promise<void>
  async queryAlerts(filters: AlertFilter): Promise<Alert[]>
  async deleteOldAlerts(olderThanMs: number): Promise<number>
}
```

### 2. Custom Alert Rules (Phase 27e)

Allow operators to define custom rules:

```typescript
alertingSystem.addRule({
  type: 'custom_rule',
  condition: (metrics) => metrics.avgCost > budget && metrics.successRate < 90,
  message: (metrics) => 'Cost-inefficient agent'
});
```

### 3. Webhook Integration (Phase 27d+)

Send alerts to external systems:

```typescript
alertingSystem.onAlert((alert) => {
  fetch('https://hooks.slack.com/services/YOUR/WEBHOOK', {
    method: 'POST',
    body: JSON.stringify({ text: alert.message })
  });
});
```

### 4. Dynamic Thresholds (Phase 27e)

Adjust thresholds based on time-of-day or load:

```typescript
const threshold = isBusinessHours() ? 90 : 70;
alertingSystem.updateRule('low_success_rate', { threshold });
```

## Files Changed

- ✅ `chat-agent/src/utils/alertingSystem.ts` (new, 300+ lines)
- ✅ `chat-agent/src/utils/prometheusExporter.ts` (new, 250+ lines)
- ✅ `chat-agent/src/server.ts` (modified, alerting initialization)
- ✅ `chat-agent/src/router/orchestrationRouter.ts` (modified, 3 new endpoints)
- ✅ `docs/PHASE_27D_ALERTING_DASHBOARDS.md` (new, this file)

## References

- **Prometheus Metrics:** https://prometheus.io/docs/concepts/data_model/
- **Grafana Dashboards:** https://grafana.com/docs/grafana/latest/dashboards/
- **Alert Best Practices:** https://prometheus.io/docs/prometheus/latest/configuration/alerting_rules/
