# Phase 27f: Cost Budgeting & Budget Enforcement

**Date:** 2026-06-20  
**Status:** Implementation Complete  
**Branch:** `claude/opensharing-omnigent-dbrx-bnyfjq`  
**Depends on:** Phase 27a (Performance Metrics)

## Overview

Phase 27f adds **budget tracking and enforcement** to CIC's orchestrator. Per-session budgets prevent cost overruns while maintaining flexibility: operators can choose hard limits (block expensive ops), soft limits (warn but allow), or alert-only mode.

## Problem Solved

Without cost control:
- Runaway sessions can incur unexpected charges
- No visibility into session spending until bill arrives
- Multi-tenant systems lack per-customer cost isolation
- Can't enforce SLA-level cost commitments

**Solution:** CostManager tracks session spending, projects final costs, and enforces configurable limits.

## New Files

### `chat-agent/src/utils/costManager.ts` (350+ lines)

**CostManager class:**

```typescript
export class CostManager {
  setBudget(config: BudgetConfig): void
  recordCost(sessionId: string, cost: number): void
  canProceed(sessionId: string, estimatedCost: number): { allowed: boolean; reason?: string }
  getSessionBudget(sessionId: string): SessionBudget | null
  getAllBudgets(): SessionBudget[]
  checkBudgetHealth(sessionId: string): void
  getAlerts(sessionId?, limit?): BudgetAlert[]
  clearBudget(sessionId: string): void
  clearExpiredBudgets(maxAgeMs?): number
  projectSessionCost(sessionId: string): { current, projected, confidence, message }
}
```

**Data Structures:**

```typescript
export type BudgetStrategy = 'hard-limit' | 'soft-limit' | 'alert-only';

export interface BudgetConfig {
  sessionId: string;
  totalBudget: number;           // Max spend in dollars
  strategy: BudgetStrategy;
  warningThreshold?: number;      // Default: 80%
  projectionEnabled?: boolean;    // Default: true
}

export interface SessionBudget {
  sessionId: string;
  totalBudget: number;
  strategy: BudgetStrategy;
  spent: number;
  remaining: number;
  percentUsed: number;
  projectedFinalCost?: number;
  tasksExecuted: number;
  createdAt: number;
  lastActivity: number;
}

export interface BudgetAlert {
  sessionId: string;
  timestamp: number;
  type: 'warning' | 'exceeded';
  spent: number;
  budget: number;
  percentUsed: number;
  message: string;
}
```

## Modified Files

### `chat-agent/src/orchestrator/orchestrator.ts`

- Import cost manager
- Check budget before task execution
- Record costs after successful execution
- Budget constraints integrated alongside policy checks

```typescript
// Before executing task:
const costManager = getCostManager();
const budget = costManager.getSessionBudget(request.sessionId);
if (budget) {
  const estimatedCost = metrics?.avgCost ?? 0.01;
  const budgetCheck = costManager.canProceed(request.sessionId, estimatedCost);
  if (!budgetCheck.allowed) {
    return this.buildResult(..., 'rejected', budgetCheck.reason, ...);
  }
}

// After successful execution:
if (status === 'success' && tokensUsed > 0) {
  costManager.recordCost(request.sessionId, metrics.avgCost);
}
```

### `chat-agent/src/router/orchestrationRouter.ts`

- Import cost manager
- Add 6 new endpoints for budget management

```typescript
POST /orchestration/budgets                    # Set budget for session
GET /orchestration/budgets/:sessionId          # Get budget status
GET /orchestration/budgets                     # Get all active budgets
GET /orchestration/budgets/alerts/active       # Get budget alerts
GET /orchestration/budgets/:sessionId/projection # Project final cost
DELETE /orchestration/budgets/:sessionId       # Clear budget
```

## API Endpoints

### 1. Set Budget for Session

```bash
# Set $100 hard limit for session (block if exceeded)
curl -X POST http://localhost:8000/orchestration/budgets \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "user-123",
    "totalBudget": 100.00,
    "strategy": "hard-limit",
    "warningThreshold": 80
  }'

# Response
{
  "message": "Budget of $100 set for session 'user-123'"
}
```

**Body Parameters:**
- `sessionId` — Session identifier (required)
- `totalBudget` — Max spending in dollars (required)
- `strategy` — Enforcement strategy (optional, default: soft-limit)
  - `hard-limit` — Block operations that exceed budget
  - `soft-limit` — Warn but allow (logged)
  - `alert-only` — Silent, only fire alerts
- `warningThreshold` — Alert at % of budget (optional, default: 80%)

### 2. Get Budget Status

```bash
# Check spending for session
curl http://localhost:8000/orchestration/budgets/user-123

# Response
{
  "budget": {
    "sessionId": "user-123",
    "totalBudget": 100.00,
    "strategy": "hard-limit",
    "spent": 27.50,
    "remaining": 72.50,
    "percentUsed": 27.5,
    "projectedFinalCost": 82.50,
    "tasksExecuted": 12,
    "createdAt": 1719010000000,
    "lastActivity": 1719018000000
  }
}
```

**Response Fields:**
- `spent` — Amount already spent
- `remaining` — Amount left in budget
- `percentUsed` — Percentage of budget consumed
- `projectedFinalCost` — Estimated final cost (extrapolated)
- `tasksExecuted` — Number of completed tasks
- `createdAt` — When budget was created
- `lastActivity` — Last task execution time

### 3. Get All Active Budgets

```bash
# List all active budgets
curl http://localhost:8000/orchestration/budgets

# Response
{
  "budgets": [
    {
      "sessionId": "user-123",
      "totalBudget": 100.00,
      "spent": 27.50,
      "remaining": 72.50,
      "percentUsed": 27.5,
      ...
    },
    {
      "sessionId": "user-456",
      "totalBudget": 50.00,
      "spent": 42.80,
      "remaining": 7.20,
      "percentUsed": 85.6,
      ...
    },
    ...
  ]
}
```

### 4. Get Budget Alerts

```bash
# Get all budget alerts
curl 'http://localhost:8000/orchestration/budgets/alerts/active?limit=50'

# Get alerts for specific session
curl 'http://localhost:8000/orchestration/budgets/alerts/active?sessionId=user-123'

# Response
{
  "alerts": [
    {
      "sessionId": "user-456",
      "timestamp": 1719018000000,
      "type": "warning",
      "spent": 40.00,
      "budget": 50.00,
      "percentUsed": 80.0,
      "message": "Session user-456 has used 80.0% of budget ($40.00/$50.00)"
    },
    {
      "sessionId": "user-123",
      "timestamp": 1719015000000,
      "type": "exceeded",
      "spent": 105.00,
      "budget": 100.00,
      "percentUsed": 105.0,
      "message": "Session user-123 EXCEEDED budget: $105.00 > $100.00"
    }
  ],
  "count": 2
}
```

### 5. Project Session Cost

```bash
# Estimate final cost based on current run rate
curl 'http://localhost:8000/orchestration/budgets/user-123/projection'

# Response
{
  "projection": {
    "current": 27.50,
    "projected": 82.50,
    "confidence": 75.0,
    "message": "Estimated final cost: $82.50 (75% confidence)"
  }
}
```

**Confidence Calculation:**
- Based on number of tasks executed vs estimated typical session length
- Higher = more accurate (100% = fully confident)
- Low confidence (<50%) suggests waiting for more data

### 6. Clear Budget

```bash
# Remove budget for session (allow unlimited spending)
curl -X DELETE http://localhost:8000/orchestration/budgets/user-123

# Response
{
  "message": "Budget cleared for session 'user-123'"
}
```

## Budget Strategies

### Strategy 1: Hard Limit

**Behavior:** Block operations that would exceed budget

```bash
curl -X POST http://localhost:8000/orchestration/budgets \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "user-123",
    "totalBudget": 50.00,
    "strategy": "hard-limit"
  }'
```

**Example flow:**
```
Task 1: Cost $10 → Allowed (total: $10/$50)
Task 2: Cost $20 → Allowed (total: $30/$50)
Task 3: Cost $25 → REJECTED (would be $55/$50)
Response: 400 Bad Request - "Cost would exceed budget"
```

**Use case:** Strict billing compliance, per-customer quotas, SLA enforcement

### Strategy 2: Soft Limit (Default)

**Behavior:** Warn but allow exceeding budget

```bash
curl -X POST http://localhost:8000/orchestration/budgets \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "user-123",
    "totalBudget": 50.00,
    "strategy": "soft-limit"
  }'
```

**Example flow:**
```
Task 1: Cost $10 → Allowed (total: $10/$50)
Task 2: Cost $20 → Allowed (total: $30/$50)
Task 3: Cost $25 → ALLOWED but WARNED (total: $55/$50)
Log: "[CostManager] Soft limit exceeded for user-123: $55 > $50"
```

**Use case:** Flexible billing, operational warnings, audit trails

### Strategy 3: Alert Only

**Behavior:** Track spending, fire alerts, never block

```bash
curl -X POST http://localhost:8000/orchestration/budgets \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "user-123",
    "totalBudget": 50.00,
    "strategy": "alert-only"
  }'
```

**Example flow:**
```
Task 1: Cost $10 → Allowed (total: $10/$50)
Task 2: Cost $20 → Allowed (total: $30/$50)
Task 3: Cost $25 → ALLOWED (total: $55/$50)
Alert: Fired (80%+ threshold crossed)
Log: Silent (no warning in logs)
```

**Use case:** Monitoring only, no enforcement, real-time tracking

## Use Cases

### 1. Multi-Tenant Cost Control

```bash
#!/bin/bash
# Set per-customer budgets

curl -X POST http://localhost:8000/orchestration/budgets \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"acme-corp","totalBudget":1000,"strategy":"hard-limit"}'

curl -X POST http://localhost:8000/orchestration/budgets \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"startup-xyz","totalBudget":100,"strategy":"hard-limit"}'

curl -X POST http://localhost:8000/orchestration/budgets \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"trial-user","totalBudget":5,"strategy":"hard-limit"}'
```

Now each customer is isolated with their own cost ceiling.

### 2. Cost-Aware Routing

Combine with Phase 27c (Adaptive Routing) to route based on budget:

```typescript
// In application code
const costManager = getCostManager();
const budget = costManager.getSessionBudget(sessionId);

let agents = ['harvester', 'harvester-lite', 'harvester-fast'];
if (budget && budget.percentUsed > 50) {
  // Budget constraints: only use cheap agents
  agents = ['harvester-lite'];
}

const best = orchestrator.selectBestAgent(agents);
```

### 3. Cost Projection & Warnings

```bash
#!/bin/bash
# Daily report: show projected overages

for session in $(curl -s http://localhost:8000/orchestration/budgets | jq -r '.budgets[].sessionId'); do
  projection=$(curl -s "http://localhost:8000/orchestration/budgets/$session/projection" | jq '.projection')
  budget=$(curl -s "http://localhost:8000/orchestration/budgets/$session" | jq '.budget')
  
  projected_cost=$(echo "$projection" | jq '.projected')
  total_budget=$(echo "$budget" | jq '.totalBudget')
  
  if (( $(echo "$projected_cost > $total_budget" | bc -l) )); then
    echo "⚠️  Session $session will exceed budget:"
    echo "  Budget: \$$total_budget"
    echo "  Projected: \$$projected_cost"
  fi
done
```

### 4. Real-Time Billing Dashboard

```bash
# Get all active budgets and alert on high usage
curl -s http://localhost:8000/orchestration/budgets | jq '
  .budgets 
  | sort_by(.percentUsed) 
  | reverse 
  | .[] 
  | select(.percentUsed > 50) 
  | "\(.sessionId): \(.percentUsed)% used (\(.spent)/\(.totalBudget))"'
```

## Integration with Other Phases

### With Phase 27d (Alerting)

Budget overages trigger cost alerts:

```
Alert Type: budget_warning
  Session: user-123
  Spent: $80
  Budget: $100
  Status: Warning (80% of budget)

Alert Type: budget_exceeded
  Session: user-456
  Spent: $105
  Budget: $100
  Status: CRITICAL
```

### With Phase 27e (Metrics Persistence)

Historical cost data enables trend analysis:

```bash
# Analyze cost growth over time
curl -s 'http://localhost:8000/orchestration/metrics/stats-historical?sessionId=user-123&startTime=...' | jq '.stats.totalCost'
```

### With Phase 27c (Adaptive Routing)

Cost becomes a routing factor:

```typescript
// Route to cheapest agent if budget is tight
const budget = costManager.getSessionBudget(sessionId);
if (budget && budget.percentUsed > 70) {
  return adaptiveRouter.selectAgent(candidates, { strategy: 'cost-optimized' });
}
```

## Monitoring & Observability

### Check high-spending sessions:

```bash
curl -s http://localhost:8000/orchestration/budgets | jq '.budgets | sort_by(.percentUsed) | reverse | .[0:3]'
```

### Get budget alerts:

```bash
curl -s 'http://localhost:8000/orchestration/budgets/alerts/active?limit=20' | jq '.alerts'
```

### Logs to watch for:

```
[CostManager] Session user-123 has used 80.0% of budget ($80.00/$100.00)
[CostManager] Session user-123 EXCEEDED budget: $105.00 > $100.00
[Orchestrator] Cost of $25.00 would exceed budget. Current: $80, Remaining: $20
```

## Configuration

### Warning Thresholds

Default: 80% of budget

```bash
# Warn at 50% (stricter)
curl -X POST http://localhost:8000/orchestration/budgets \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "user-123",
    "totalBudget": 100.00,
    "warningThreshold": 50
  }'
```

### Budget Strategies

Choose based on use case:

| Strategy | Enforcement | Use Case |
|----------|-------------|----------|
| `hard-limit` | Block operations | Billing compliance, strict quotas |
| `soft-limit` | Warn but allow | Flexible billing, operational visibility |
| `alert-only` | Track only | Monitoring, no enforcement |

## Performance Impact

- **CPU:** <1ms per budget check, <1ms per cost record
- **Memory:** ~100B per session budget (~100KB for 1000 sessions)
- **Network:** None (in-memory)
- **Disk:** None (unless persisted)

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

# 2. Set budget for test session
curl -X POST http://localhost:8000/orchestration/budgets \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"test","totalBudget":10.00,"strategy":"hard-limit"}'

# 3. Execute tasks (will accumulate cost)
for i in {1..5}; do
  curl -X POST http://localhost:8000/orchestration/tasks \
    -H "Content-Type: application/json" \
    -d '{"sessionId":"test","agent":"harvester","instruction":"Count to 3"}' &
done
wait

# 4. Check budget status
curl http://localhost:8000/orchestration/budgets/test | jq .

# 5. Get alerts
curl 'http://localhost:8000/orchestration/budgets/alerts/active' | jq .

# 6. Get projection
curl 'http://localhost:8000/orchestration/budgets/test/projection' | jq .
```

## Files Changed

- ✅ `chat-agent/src/utils/costManager.ts` (new, 350+ lines)
- ✅ `chat-agent/src/orchestrator/orchestrator.ts` (modified, budget checking + cost recording)
- ✅ `chat-agent/src/router/orchestrationRouter.ts` (modified, 6 new endpoints)
- ✅ `docs/PHASE_27F_COST_BUDGETING.md` (new, this file)

## Next Steps (Phase 27f+)

### 1. Budget Persistence (Phase 27g)

Save budgets to disk for recovery:

```typescript
export class PersistentBudgetManager extends CostManager {
  async saveBudgets(): Promise<void>
  async loadBudgets(): Promise<void>
}
```

### 2. Dynamic Budget Adjustment (Phase 27g)

Auto-adjust budgets based on usage patterns:

```typescript
// If customer is consistently using 90% of budget, increase
if (usagePattern.percentile90 > 85) {
  increaseBudget(sessionId, byPercent: 20);
}
```

### 3. Multi-Tier Budgets (Phase 27g)

Different budgets for different operations:

```typescript
{
  sessionId: "user-123",
  defaultBudget: 100,
  agentBudgets: {
    "harvester": 30,
    "enricher": 50,
    "evaluator": 20
  }
}
```

### 4. Billing Integration (Phase 28)

Export budget data for invoicing:

```typescript
async exportForBilling(periodStartTime, periodEndTime) {
  return {
    sessionId,
    period: { startTime, endTime },
    totalSpent,
    chargeableAmount,
    discounts
  };
}
```

## References

- **SaaS Billing Patterns:** https://stripe.com/guides/saas-billing
- **Usage-Based Pricing:** https://www.paddle.com/blog/usage-based-pricing/
- **Cost Optimization:** https://cloud.google.com/architecture/best-practices-for-cost-optimization
