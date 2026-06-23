# WS-A: Budget Ledger

Authoritative token usage and cost tracking for the M2 execution framework.

## Overview

The Budget Ledger is the single source of truth for:
- **Token accounting**: Tracks all token consumption per agent/session
- **Cost tracking**: Maintains cumulative costs and projections
- **Rate limiting**: Enforces budget constraints at write-time
- **Governance**: Emits abort/warning events when thresholds are crossed
- **SLO integration**: Provides rolling window data for burn-rate calculation

## Getting Started

### Install Dependencies

```bash
npm install
```

### Build

```bash
npm run build
```

### Development

```bash
npm run dev
```

### Type Checking

```bash
npm run type-check
```

## Architecture

### Core Modules

- **schema/types.ts** — TypeScript interfaces and error classes
- **schema/budget_ledger_v3.sql** — PostgreSQL schema with indexes and constraints
- **db/client.ts** — Connection pooling and transaction management
- **write/writeLedgerEntry.ts** — Atomic write with validation and retry logic
- **governance/governanceEvents.ts** — Event emission for budget thresholds
- **metrics/ledgerMetrics.ts** — Prometheus metrics collection
- **utils/logging.ts** — Structured JSON logging

### Write Path

The write path (`writeLedgerEntry`) performs:

1. **Validation** — Enforces schema constraints
2. **Idempotency** — Uses `entry_id` to prevent duplicates
3. **Atomic Transaction** — Inserts entry and checks governance conditions
4. **Retry Logic** — Exponential backoff (100ms, 200ms, 400ms) for transient failures
5. **Governance Events** — Emits abort/warning events on threshold violations
6. **Metrics Recording** — Tracks write latency and failure rates

### SLA Targets

| Metric | Target |
|--------|--------|
| Write latency p95 | < 20ms |
| Write latency p99 | < 40ms |
| Write failure rate | < 0.1% |

## Usage Example

```typescript
import { initializeDb, writeLedgerEntry } from '@castironforge/budget-ledger';

// Initialize database connection
initializeDb({
  host: 'localhost',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'password',
  max: 20,
});

// Write a ledger entry
const result = await writeLedgerEntry({
  agentId: 'agent-001',
  sessionId: 'session-abc123',
  tokensUsed: 150,
  costUsd: 0.00450,
  cumulativeTokens: 1000,
  cumulativeCostUsd: 0.03000,
  projectedCostUsd: 0.10000,
  metadata: { model: 'gpt-4', region: 'us-west-2' },
}, {
  governanceConfig: {
    maxTokens: 100000,
    maxCostUsd: 50.00,
    warningThresholdPercent: 0.80,
    caustionThresholdPercent: 0.70,
  },
});

console.log(result);
// {
//   entryId: '...',
//   agentId: 'agent-001',
//   sessionId: 'session-abc123',
//   timestamp: 2026-06-23T...,
//   status: 'success',
//   latencyMs: 8,
//   governanceEvents: [...]
// }
```

## Governance Events

### Budget Exhaustion (Abort)

Emitted when:
- `cumulative_tokens > max_tokens`
- `cumulative_cost_usd > max_cost`
- `projected_cost_usd > max_cost`

Actions:
- Abort active pipeline
- Notify SLO Controller
- Stop accepting new writes

### Threshold Warning

Emitted when:
- `projected_cost_usd > 80% of max_cost`
- `cumulative_cost_usd > 70% of max_cost`

Actions:
- Log event
- Notify observability dashboard
- **Do NOT abort** — allow pipeline to continue

## Metrics

Prometheus metrics are available via `getPrometheusMetrics()`:

```
ledger_writes_total
ledger_write_failures_total
ledger_write_latency_p95_ms
ledger_write_latency_p99_ms
ledger_read_latency_p95_ms
ledger_read_latency_p99_ms
ledger_drift_total
ledger_budget_exhaustion_events_total
ledger_governance_abort_total
ledger_governance_warning_total
```

## Testing

```bash
npm test
npm run test:watch
npm run test:coverage
```

Requires ≥40 unit tests and ≥12 integration tests per specification.

## Integration

### SLO Controller (WS-B)

The SLO Controller consumes:
- Rolling window query results (1m, 5m, 30m windows)
- Governance abort/warning events
- Current cumulative totals

### Adapter Gateway Cache (WS-C)

The cache integrates via:
- Event-based invalidation on governance_abort
- Metrics integration for hit-rate reporting

### Fire Drills (WS-D)

Fire drills validate:
- Budget exhaustion scenarios
- Governance event propagation
- Deterministic rollback behavior

## Deployment

See the M2 execution framework documentation in `/docs/m2/WS-A-Budget-Ledger/`.
