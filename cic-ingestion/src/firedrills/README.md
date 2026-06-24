# Fire Drills (WS-D)

Automated chaos testing for the CIC (Chat Iron Ingestion) reliability pipeline.

## Overview

Fire drills simulate failures to validate that the SLO Controller correctly detects violations and triggers enforcement actions. Each drill:

1. **Injects faults** — adapter failures, latency, saturation, cascading failures
2. **Verifies SLO responses** — checks that violations are detected
3. **Validates enforcement** — confirms enforcement actions are triggered
4. **Measures recovery** — tracks time-to-healthy after faults clear

## Architecture

```
firedrills/
  ├─ FireDrillTypes.ts       — Type definitions
  ├─ FireDrillEngine.ts      — Core orchestration engine
  ├─ FireDrillScenarios.ts   — Built-in chaos scenarios
  ├─ __tests__/
  │  └─ FireDrillEngine.test.ts  — 50+ test cases
  └─ README.md               — This file
```

## Fault Types

### ADAPTER_FAILURE
Marks an adapter as unhealthy, simulating complete failure.

```typescript
{
  type: FireDrillFaultType.ADAPTER_FAILURE,
  targetAdapter: 'adapter1',
  durationMs: 2000,
  severity: 2,
  config: { failureRate: 1.0 }
}
```

### LATENCY_INJECTION
Adds latency to adapter responses, testing p99 threshold violations.

```typescript
{
  type: FireDrillFaultType.LATENCY_INJECTION,
  targetAdapter: 'adapter1',
  durationMs: 3000,
  severity: 2,
  config: { latencyMs: 2500 }
}
```

### SATURATION_INJECTION
Simulates queue backlog, testing saturation SLO responses.

```typescript
{
  type: FireDrillFaultType.SATURATION_INJECTION,
  targetAdapter: 'adapter1',
  durationMs: 3000,
  severity: 2,
  config: { queueDepth: 150 }
}
```

### PARTIAL_OUTAGE
Fails a percentage of requests, testing error-rate SLOs.

```typescript
{
  type: FireDrillFaultType.PARTIAL_OUTAGE,
  targetAdapter: 'adapter1',
  durationMs: 3000,
  severity: 2,
  config: { failureRate: 0.5 } // 50% fail
}
```

### CASCADING_FAILURE
Fails a primary adapter and degrades dependent adapters.

```typescript
{
  type: FireDrillFaultType.CASCADING_FAILURE,
  targetAdapter: 'primary',
  durationMs: 3000,
  severity: 3,
  config: { failureRate: 1.0 }
}
```

## Assertions

Fire drills verify system behavior through assertions:

### SLO_VIOLATION_DETECTED
Confirms that a violation was detected and recorded.

```typescript
{
  type: FireDrillAssertionType.SLO_VIOLATION_DETECTED,
  condition: (ctx) => ctx.sloViolations.length > 0,
  description: 'SLO violation recorded'
}
```

### ENFORCEMENT_ACTION_TAKEN
Confirms that an enforcement action was triggered (ABORT_PIPELINE, ROLLBACK_ADAPTER, etc.).

```typescript
{
  type: FireDrillAssertionType.ENFORCEMENT_ACTION_TAKEN,
  condition: (ctx) => ctx.enforcementActions.length > 0,
  description: 'Enforcement action triggered'
}
```

### RECOVERY_SUCCESSFUL
Confirms that the system recovered to a healthy state after faults cleared.

```typescript
{
  type: FireDrillAssertionType.RECOVERY_SUCCESSFUL,
  condition: (ctx) => Object.values(ctx.adapterHealthStatus).every(h => h.isHealthy),
  description: 'System recovered',
  timeoutMs: 5000
}
```

### ADAPTER_HEALTH_UPDATED
Confirms that adapter health status changed.

```typescript
{
  type: FireDrillAssertionType.ADAPTER_HEALTH_UPDATED,
  condition: (ctx) => ctx.adapterHealthStatus['adapter1']?.failureCount > 0,
  description: 'Adapter health updated'
}
```

### LATENCY_WITHIN_THRESHOLD
Confirms that latency returned to normal after injection.

```typescript
{
  type: FireDrillAssertionType.LATENCY_WITHIN_THRESHOLD,
  condition: (ctx) => (ctx.metrics?.avgLatency ?? 0) < 500,
  description: 'Latency within threshold',
  timeoutMs: 5000
}
```

## Built-in Scenarios

### SIMPLE_ADAPTER_FAILURE
Single adapter fails; validates health detection and recovery.

- **Severity:** 2 (moderate)
- **Duration:** 5 seconds
- **Tags:** basic, adapter, health
- **Assertions:** 2 (health updated, recovery successful)

### HIGH_LATENCY
Inject latency; validates p99 threshold violation detection.

- **Severity:** 2 (moderate)
- **Duration:** 5 seconds
- **Tags:** latency, slo, threshold
- **Assertions:** 2 (SLO violation detected, latency recovery)

### CASCADING_FAILURE
Primary adapter fails; dependent adapters degrade.

- **Severity:** 3 (severe)
- **Duration:** 8 seconds
- **Tags:** cascading, critical, dependencies
- **Assertions:** 3 (violation detected, enforcement triggered, recovery successful)

### PARTIAL_OUTAGE
50% of requests fail; validates error-rate SLO response.

- **Severity:** 2 (moderate)
- **Duration:** 6 seconds
- **Tags:** error-rate, availability, slo
- **Assertions:** 2 (violation detected, enforcement triggered)

### SATURATION
Queue depth increases; validates saturation SLO response.

- **Severity:** 2 (moderate)
- **Duration:** 6 seconds
- **Tags:** saturation, queue-depth, resources
- **Assertions:** 2 (violation detected, enforcement triggered)

### MULTI_FAULT
Multiple simultaneous failures; validates cascade handling.

- **Severity:** 2-3 (mixed)
- **Duration:** 10 seconds
- **Tags:** critical, multi-fault, resilience
- **Assertions:** 3 (violations detected, enforcement triggered, recovery successful)

## Usage

### Basic: Run a built-in scenario

```typescript
import { FireDrillEngine } from './FireDrillEngine';
import { FireDrillScenarios } from './FireDrillScenarios';

const engine = new FireDrillEngine({
  verbose: true,
  timeoutMs: 10000,
  recordMetrics: true,
});

const result = await engine.runScenario(FireDrillScenarios.HIGH_LATENCY);

console.log(`✓ ${result.passed ? 'PASS' : 'FAIL'} — ${result.durationMs}ms`);
console.log(`  Assertions: ${result.assertionsPassed}/${result.assertionsPassed + result.assertionsFailed}`);
console.log(`  Recovery time: ${result.metrics.recoveryTime}ms`);
```

### Advanced: Custom scenario

```typescript
const customScenario: FireDrillScenario = {
  id: 'my-scenario',
  name: 'My Custom Scenario',
  description: 'Custom chaos test',
  tags: ['custom'],
  expectedDuration: 5000,
  faults: [
    {
      type: FireDrillFaultType.ADAPTER_FAILURE,
      targetAdapter: 'critical-adapter',
      durationMs: 2000,
      severity: 3,
      config: { failureRate: 1.0 },
    },
  ],
  assertions: [
    {
      type: FireDrillAssertionType.ENFORCEMENT_ACTION_TAKEN,
      condition: (ctx) => ctx.enforcementActions.length > 0,
      description: 'Critical adapter failure triggers enforcement',
      timeoutMs: 3000,
    },
  ],
};

const result = await engine.runScenario(customScenario);
```

### Filter scenarios by tag

```typescript
const basicScenarios = FireDrillScenarios.getScenariosByTag('basic');
const criticalScenarios = FireDrillScenarios.getScenariosBySeverity(3);

for (const scenario of criticalScenarios) {
  const result = await engine.runScenario(scenario);
  // Process result
}
```

### Get results and summary

```typescript
const summary = engine.getSummary();

console.log(`Fire Drills: ${summary.totalRuns} runs`);
console.log(`  Passed: ${summary.passed} (${(summary.passRate * 100).toFixed(1)}%)`);
console.log(`  Failed: ${summary.failed}`);
console.log(`  Avg duration: ${summary.avgDuration.toFixed(0)}ms`);
console.log(`  Total faults: ${summary.totalFaultsInjected}`);

const results = engine.getResults();
for (const result of results) {
  console.log(`\n${result.scenarioId}: ${result.passed ? '✓' : '✗'}`);
  console.log(`  Duration: ${result.durationMs}ms`);
  console.log(`  Assertions: ${result.assertionsPassed}/${result.assertionsPassed + result.assertionsFailed}`);
  if (result.violations.length > 0) {
    console.log(`  Violations:`);
    for (const v of result.violations) {
      console.log(`    - ${v.description}`);
    }
  }
}
```

## Configuration

### FireDrillOptions

```typescript
interface FireDrillOptions {
  maxConcurrentDrills: number;  // Max parallel drills (default: 5)
  timeoutMs: number;            // Assertion timeout (default: 60000ms)
  verbose: boolean;             // Log to console (default: false)
  recordMetrics: boolean;       // Collect metrics (default: true)
}
```

### Example

```typescript
const engine = new FireDrillEngine({
  maxConcurrentDrills: 10,
  timeoutMs: 15000,
  verbose: true,
  recordMetrics: true,
});
```

## Metrics

Each fire drill result includes:

- `totalLatencySamples` — Count of latency measurements
- `avgLatency` — Average latency (ms)
- `p50Latency` — 50th percentile latency
- `p99Latency` — 99th percentile latency
- `errorCount` — Total errors during drill
- `errorRate` — Error rate (0-1)
- `successCount` — Total successes
- `recoveryTime` — Time from fault clear to healthy (ms)

## Test Coverage

- 50+ test cases covering:
  - Scenario execution
  - All fault types
  - All assertion types
  - Built-in scenarios
  - Metrics collection
  - Error handling
  - Concurrent limits

## Integration with SLO Controller

Fire drills validate that the SLO Controller:

1. **Detects violations** — Latency, error-rate, saturation metrics are tracked
2. **Triggers enforcement** — ABORT_PIPELINE, ROLLBACK_ADAPTER, DEGRADE_MODE actions are taken
3. **Recovers gracefully** — System returns to healthy state after faults clear
4. **Handles cascades** — Dependent adapters degrade appropriately

## Next Steps

- Integrate with SLO Controller and AdapterGateway for real system testing
- Add WebSocket event publishing for fire drill status
- Export fire drill metrics to Prometheus
- Build Grafana dashboard for drill visualization
- Schedule automated weekly fire drills
