# CIC Ingestion Engine

**Chat Iron Check (CIC)** is the reliability and orchestration engine for the castironforge platform. It provides deterministic, operator-grade enforcement of SLOs, adapter management, and fire-drill automation across the entire ingestion pipeline.

## Phase-27 Workstreams

- **WS-A**: Budget Ledger (coming soon)
- **WS-B**: SLO Controller (in progress)
- **WS-C**: Adapter Gateway Cache (coming soon)
- **WS-D**: Fire Drills (coming soon)

## Architecture

```
cic-ingestion/
  src/
    slo/              — WS-B: SLO Controller (latency, error-rate, saturation)
    agents/           — WarmPoolManager, SpaHydrationDetector, DomSampler, VerticalDriftDetector
    adapter/          — WS-C: AdapterGateway, AdapterCache, AdapterHealth
    metrics/          — Prometheus exporter and metrics registry
    orchestrator/     — EventBus, PipelineOrchestrator, WebSocketOrchestrator
    utils/            — Shared utilities (RollingWindow, Logger, Time)
```

## WS-B: SLO Controller

The SLO Controller is the reliability enforcement engine. It consumes metrics, computes burn-rates, evaluates SLO domains (latency, error-rate, saturation), and triggers enforcement actions (abort, rollback, degrade, quarantine).

### Key Components

- **SLOController**: Core evaluation and burn-rate computation
- **SLOState**: Rolling window management and metric accumulation
- **SLOPrometheusExporter**: Metrics export at `/metrics/slo`
- **SLOWebSocketBridge**: Event publishing and adapter health subscription

### Requirements

- Deterministic evaluation logic
- Operator-grade observability
- Zero-ambiguity enforcement decisions
- <10ms Prometheus scrape latency

## Build

```bash
npm install
npm run build
```

## Testing

```bash
npm test
```

## Integration

CIC integrates with:
- **chat-agent**: Backend runtime (optional, not a direct dependency)
- **chat-frontend**: UI (optional, not a direct dependency)
- **TorqueQuery**: RAG service (optional)
- **Prometheus**: Metrics scraping

CIC is operationally independent and can run alongside the chat infrastructure.

---

**Status**: Phase-27 WS-B implementation in progress. Skeleton complete, WS-B SLO Controller fully implemented.
