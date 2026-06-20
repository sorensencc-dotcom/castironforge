# Phase 27a: Agent Performance Metrics & Monitoring

**Date:** 2026-06-20  
**Status:** Implementation Complete  
**Branch:** `claude/opensharing-omnigent-dbrx-bnyfjq`

## Overview

Phase 27a adds **per-agent performance tracking** to CIC's orchestrator. Operators can now monitor agent efficiency, cost, and reliability in real-time.

## What's Tracked

For each agent, the system tracks:

```
Execution Counts:
  • Total executions
  • Successful tasks
  • Failed tasks
  • Timed out tasks
  • Rejected tasks

Aggregated Stats:
  • Total execution time (ms)
  • Total tokens used
  • Total estimated cost ($)

Averages:
  • Average execution time
  • Average tokens per task
  • Average cost per task

Rates (percentages):
  • Success rate
  • Failure rate
  • Timeout rate
  • Rejection rate

Recent Activity:
  • Last execution timestamp
  • Last status
  • Last error message
```

## New Files

### `chat-agent/src/utils/performanceTracker.ts` (200+ lines)

**PerformanceTracker class:**

```typescript
export class PerformanceTracker {
  recordExecution(taskId, agentRole, model, duration, tokensUsed, status, error): void
  getMetrics(agentRole): AgentMetrics | undefined
  getAllMetrics(): AgentMetrics[]
  getHistory(agentRole?, limit, status?): ExecutionRecord[]
  getSummaryStats(): {totalExecutions, successRate, avgDuration, avgCost, totalCost}
  resetMetrics(agentRole): void
  resetAll(): void
}
```

**Data Structures:**

```typescript
interface AgentMetrics {
  agentRole: AgentRole;
  totalExecutions: number;
  successCount: number;
  failureCount: number;
  timeoutCount: number;
  rejectionCount: number;
  
  totalDuration: number;        // ms
  totalTokens: number;
  totalCost: number;            // $
  
  avgDuration: number;          // ms
  avgTokens: number;
  avgCost: number;              // $
  
  successRate: number;          // %
  failureRate: number;          // %
  timeoutRate: number;          // %
  rejectionRate: number;        // %
  
  lastExecution?: number;       // timestamp
  lastStatus?: 'success' | 'failed' | 'timeout' | 'rejected';
  lastError?: string;
}

interface ExecutionRecord {
  taskId: string;
  agentRole: AgentRole;
  model: string;
  timestamp: number;
  duration: number;
  tokensUsed: number;
  status: 'success' | 'failed' | 'timeout' | 'rejected';
  error?: string;
  estimatedCost: number;
}
```

**Cost Estimation:**

Built-in model cost estimates ($ per 1M tokens):

```typescript
'local:*'         → $0         (self-hosted, free)
'cpu:*'           → $0         (self-hosted, free)
'sharing:gemini*' → $0.075     (cheapest)
'sharing:dbrx*'   → $0.50
'databricks:*'    → $0.50
'sharing:claude*' → $3.00      (most expensive)
'sharing:gpt*'    → $3.00
```

Customizable via constructor: `new PerformanceTracker(customModelCosts)`

## Modified Files

### `chat-agent/src/orchestrator/orchestrator.ts`

- Import performanceTracker
- Call `performanceTracker.recordExecution()` in buildResult()
- Automatic tracking of all task executions

### `chat-agent/src/router/orchestrationRouter.ts`

Added 5 new endpoints for metrics visibility.

## API Endpoints

### 1. Get Metrics for All Agents

```bash
curl http://localhost:8000/orchestration/metrics

# Response
{
  "metrics": [
    {
      "agentRole": "harvester",
      "totalExecutions": 125,
      "successCount": 118,
      "failureCount": 5,
      "timeoutCount": 2,
      "rejectionCount": 0,
      "totalDuration": 153750,      # ms
      "totalTokens": 18750,
      "totalCost": 9.375,           # $
      "avgDuration": 1230,
      "avgTokens": 150,
      "avgCost": 0.075,
      "successRate": 94.4,
      "failureRate": 4.0,
      "timeoutRate": 1.6,
      "rejectionRate": 0,
      "lastExecution": 1719018012345,
      "lastStatus": "success"
    },
    {
      "agentRole": "enricher",
      "totalExecutions": 87,
      "successCount": 85,
      "failureCount": 2,
      ...
    },
    ...
  ],
  "summary": {
    "totalExecutions": 312,
    "successRate": 93.6,
    "avgDuration": 1205,
    "avgCost": 0.082,
    "totalCost": 25.48
  }
}
```

### 2. Get Metrics for Specific Agent

```bash
curl http://localhost:8000/orchestration/metrics/harvester

# Response
{
  "metrics": {
    "agentRole": "harvester",
    "totalExecutions": 125,
    "successCount": 118,
    ...
  }
}
```

### 3. Get Execution History

```bash
curl "http://localhost:8000/orchestration/history?agent=harvester&status=success&limit=50"

# Response
{
  "history": [
    {
      "taskId": "task-789",
      "agentRole": "harvester",
      "model": "local:qwen",
      "timestamp": 1719018012345,
      "duration": 1234,
      "tokensUsed": 150,
      "status": "success",
      "estimatedCost": 0
    },
    {
      "taskId": "task-788",
      "agentRole": "harvester",
      "model": "local:qwen",
      "timestamp": 1719018010111,
      "duration": 1456,
      "tokensUsed": 180,
      "status": "success",
      "estimatedCost": 0
    },
    ...
  ]
}
```

**Query Parameters:**
- `agent` — Filter by agent role (optional)
- `status` — Filter by status: success/failed/timeout/rejected (optional)
- `limit` — Max results (default: 100)

### 4. Reset Metrics

**Reset for specific agent:**
```bash
curl -X POST http://localhost:8000/orchestration/metrics/reset \
  -H "Content-Type: application/json" \
  -d '{"agentRole": "harvester"}'

# Response
{"message": "Metrics reset for agent 'harvester'"}
```

**Reset all metrics:**
```bash
curl -X POST http://localhost:8000/orchestration/metrics/reset

# Response
{"message": "All metrics reset"}
```

## Use Cases

### 1. Monitor Agent Health

```bash
# Which agent has the highest success rate?
curl http://localhost:8000/orchestration/metrics | jq '.metrics | sort_by(.successRate) | reverse | .[0]'

# Output: enricher with 98% success rate
```

### 2. Cost Visibility

```bash
# What's our total estimated cost across all agents?
curl http://localhost:8000/orchestration/metrics | jq '.summary.totalCost'

# Output: 25.48 (dollars)
```

### 3. Performance Debugging

```bash
# Why is harvester slow?
curl http://localhost:8000/orchestration/metrics/harvester | jq '.metrics.avgDuration'

# Output: 1230 (ms average)

# Check recent errors
curl "http://localhost:8000/orchestration/history?agent=harvester&status=failed&limit=10"
```

### 4. Capacity Planning

```bash
# How many tasks can we handle per minute?
curl http://localhost:8000/orchestration/metrics | jq '.summary.avgDuration'

# If avg is 1200ms, we can do ~50 tasks/min on single machine
# Plan: Add more replicas if needed
```

### 5. Model Cost Analysis

```bash
# Is our current model assignment cost-effective?
# Get metrics, identify expensive agents
curl http://localhost:8000/orchestration/metrics | jq '.metrics | map(select(.avgCost > 0.50)) | .[].agentRole'

# Reassign those agents to cheaper models
```

## Operator Workflow

### Daily Monitoring

```bash
#!/bin/bash
# daily_metrics.sh

echo "=== CIC Daily Metrics Report ==="
echo ""

echo "Overall Success Rate:"
curl -s http://localhost:8000/orchestration/metrics | jq '.summary.successRate' | xargs echo

echo ""
echo "Top Agent by Volume:"
curl -s http://localhost:8000/orchestration/metrics | jq '.metrics | max_by(.totalExecutions) | .agentRole'

echo ""
echo "Estimated Daily Cost:"
curl -s http://localhost:8000/orchestration/metrics | jq '.summary.totalCost' | xargs echo

echo ""
echo "Agent Performance:"
curl -s http://localhost:8000/orchestration/metrics | jq '.metrics[] | "\(.agentRole): \(.successRate)% success, \(.avgDuration)ms, $\(.avgCost)"' | column -t
```

### Alert on High Failure Rate

```bash
#!/bin/bash
# alert_failures.sh

FAILURE_THRESHOLD=5  # percent

curl -s http://localhost:8000/orchestration/metrics | jq '.metrics[]' | while read -r metric; do
  FAILURE_RATE=$(echo "$metric" | jq '.failureRate')
  
  if (( $(echo "$FAILURE_RATE > $FAILURE_THRESHOLD" | bc -l) )); then
    AGENT=$(echo "$metric" | jq -r '.agentRole')
    echo "ALERT: Agent '$AGENT' has failure rate of $FAILURE_RATE%"
    # Send to Slack, PagerDuty, etc.
  fi
done
```

## Performance Impact

- **Memory:** ~1KB per execution record; default limit 10k records (~10MB)
- **CPU:** <1ms per task recording (negligible)
- **Disk:** Only if persisting history (not enabled by default)

## Testing

### Type Check

```bash
cd chat-agent
./node_modules/.bin/tsc --noEmit
# (no output = success)
```

### Manual Test

```bash
# 1. Execute some tasks
for i in {1..10}; do
  curl -X POST http://localhost:8000/orchestration/tasks \
    -H "Content-Type: application/json" \
    -d '{
      "sessionId": "test",
      "agent": "harvester",
      "instruction": "Count to 10"
    }' 2>/dev/null
done

# 2. Check metrics
curl http://localhost:8000/orchestration/metrics | jq '.metrics[0] | {totalExecutions, successRate, avgDuration}'

# 3. Check history
curl http://localhost:8000/orchestration/history?agent=harvester | jq '.history | length'
```

## Next Steps (Phase 27a+)

### 1. Persist Metrics

Store metrics to file/database for historical analysis:

```typescript
export class PersistentMetricsStore {
  async saveSnapshot(): Promise<void>
  async loadSnapshot(): Promise<void>
  async queryRange(startTime, endTime): Promise<AgentMetrics[]>
}
```

### 2. Alerting Integration

Hook metrics into alerting system:

```bash
# Slack alert on failures
if failureRate > 10:
  post_to_slack("Agent harvester has high failure rate")

# PagerDuty incident on cascade failure
if allAgents.successRate < 50:
  create_pagerday_incident()
```

### 3. Grafana Dashboards

Export metrics to Prometheus for visualization:

```bash
# Prometheus format
cic_agent_success_rate{agent="harvester"} 94.4
cic_agent_avg_duration_ms{agent="harvester"} 1230
cic_agent_total_cost_usd 25.48
```

### 4. Adaptive Routing (Phase 27c)

Use metrics to auto-select best agent:

```typescript
// Choose agent with lowest cost + high success rate
function selectBestAgent(task: Task): AgentRole {
  const metrics = performanceTracker.getAllMetrics();
  return metrics
    .filter(m => m.successRate > 90)
    .sort((a, b) => a.avgCost - b.avgCost)[0].agentRole;
}
```

## Data Retention

- **Default:** Last 10,000 execution records (in-memory)
- **Per-agent metrics:** Unlimited (continuously updated)
- **History older than limit:** Discarded (metrics remain)

To keep longer history:

```typescript
const tracker = new PerformanceTracker();
tracker.maxHistorySize = 100000;  // Keep 100k records
```

## References

- **Prometheus Metrics:** https://prometheus.io/docs/concepts/data_model/
- **Agent Monitoring:** https://opentelemetry.io/docs/instrumentation/
- **Cost Optimization:** https://cloud.google.com/architecture/best-practices-for-cost-optimization
