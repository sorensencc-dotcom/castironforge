# CIC Integration

This directory contains integration hooks between the chat-agent and the CIC (Chat Iron Ingestion) subsystem.

## Overview

The CIC integration provides:

1. **SLO Monitoring** — Tracks latency, error-rate, and saturation metrics for chat-agent operations
2. **Adapter Gateway** — Caches external service responses with multiple eviction policies
3. **Health Reporting** — Exposes CIC health status via the `/health` endpoint
4. **Metrics Export** — Publishes CIC metrics to Prometheus (`/orchestration/metrics/prometheus`)

## Architecture

```
chat-agent
  ├─ server.ts (initializes CICIntegration)
  ├─ router/
  │  ├─ chatAgentRouter.ts (extends /health with CIC status)
  │  └─ orchestrationRouter.ts (exports CIC metrics to Prometheus)
  ├─ mcp/tools/
  │  └─ cic.ts (MCP tools for CIC control)
  └─ cic/
     ├─ CICIntegration.ts (main integration service)
     └─ README.md (this file)
```

## Initialization

CIC is initialized during server startup in `server.ts`:

```typescript
const cicIntegration = initializeCIC({
  enabled: true,
  sloThresholds: {
    latencyP99Ms: 5000,
    errorRatePercent: 5,
    saturationPercent: 80,
  }
});
await cicIntegration.initialize();
```

The integration is **optional and non-blocking** — if CIC initialization fails, chat-agent continues normally without CIC monitoring.

## API Integration

### Health Endpoint

The `/health` endpoint now includes CIC status:

```bash
curl http://localhost:8000/health
```

Response:

```json
{
  "status": "ok",
  "runtimes": { ... },
  "tika": { ... },
  "cic": {
    "cicAvailable": true,
    "sloController": {
      "isHealthy": true,
      "lastViolation": "none"
    },
    "adapterGateway": {
      "healthyAdapters": ["adapter1", "adapter2"],
      "totalAdapters": 2
    }
  }
}
```

### Prometheus Metrics

CIC metrics are exported to the Prometheus endpoint:

```bash
curl http://localhost:8000/orchestration/metrics/prometheus
```

Metrics include:

- `cic_slo_violations_total{adapter="..."}` — Total SLO violations per adapter
- `cic_slo_successes_total{adapter="..."}` — Total successful operations per adapter
- `cic_adapter_healthy{adapter="..."}` — Health status (1=healthy, 0=unhealthy)
- `cic_cache_hits_total` — Total cache hits
- `cic_cache_misses_total` — Total cache misses
- `cic_cache_evictions_total` — Total evictions
- `cic_cache_entries` — Current number of cache entries
- `cic_cache_size_bytes` — Current cache size in bytes
- `cic_cache_hit_rate` — Cache hit rate (0-1)

### MCP Tools

New CIC tools are available via MCP:

**cic.health** — Get CIC health status
```json
{
  "success": true,
  "data": {
    "cicAvailable": true,
    "sloController": { ... },
    "adapterGateway": { ... }
  }
}
```

**cic.metrics** — Export CIC metrics
```json
{
  "success": true,
  "data": {
    "metrics": "cic_slo_violations_total{adapter=\"adapter1\"} 0\n...",
    "format": "prometheus",
    "timestamp": "2026-06-24T10:00:00Z"
  }
}
```

## Recording Operations

To record chat-agent operations for SLO monitoring:

```typescript
import { getCICIntegration } from './cic/CICIntegration';

const cicIntegration = getCICIntegration();
const startTime = Date.now();

try {
  // Perform operation
  await someOperation();
  cicIntegration.recordOperation('adapter-name', 'operation-name', Date.now() - startTime, true);
} catch (err) {
  cicIntegration.recordOperation('adapter-name', 'operation-name', Date.now() - startTime, false);
  throw err;
}
```

## Configuration

CIC integration is configured via the `CICIntegrationConfig`:

```typescript
interface CICIntegrationConfig {
  enabled: boolean;  // Enable/disable CIC integration
  sloThresholds?: {
    latencyP99Ms?: number;       // P99 latency threshold (default: 2000ms)
    errorRatePercent?: number;   // Error rate threshold (default: 5%)
    saturationPercent?: number;  // Saturation threshold (default: 80%)
  };
}
```

## Troubleshooting

If CIC fails to initialize, check the logs:

```
[CIC] Failed to initialize integration: [error message]
[CIC] Chat-agent will continue without CIC monitoring
```

This is expected if:
- The cic-ingestion package is not built/available
- The path to cic-ingestion is incorrect
- There's a TypeScript compilation error in CIC modules

## Optional: Using CIC Components

For advanced use cases, you can directly access CIC components:

```typescript
import { getCICIntegration } from './cic/CICIntegration';

const cic = getCICIntegration();

// Get health status
const health = cic.getHealthStatus();

// Export metrics
const metrics = cic.exportMetrics();

// Check if CIC is available
if (cic.isAvailable()) {
  // Use CIC features
}
```

## Next Steps

- Wire adapter operations to use `AdapterGateway` for response caching
- Integrate SLO violation webhooks for alerting
- Set up Grafana dashboards for CIC metrics visualization
- Implement fire-drill automation (WS-D) in CIC for chaos testing
