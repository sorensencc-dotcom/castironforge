# WS-B: SLO Controller — Overview

The SLO Controller is the reliability‑enforcement subsystem for CIC.
It continuously evaluates system health using latency, error‑rate, and saturation metrics, computes burn‑rates across multiple windows, and triggers enforcement actions when SLOs are violated.

## Purpose

The SLO Controller is the decision engine for:

- **Canary aborts** — halt canary rollouts on SLO violations
- **Governance escalation** — notify Budget Ledger of reliability failures
- **Reliability enforcement** — throttle or terminate pipelines
- **Burn‑rate‑based throttling** — dynamic request flow control
- **Fire‑drill validation** — verify SLO enforcement under stress

## Integration Points

The SLO Controller integrates tightly with:

- **Prometheus** — metrics ingestion and alerting
- **Canary Gates** — abort and rollback decisions
- **Budget Ledger** — governance signal propagation
- **Adapter Gateway** — latency and error surface collection
- **Fire Drills** — resilience validation scenarios

## Key Properties

- **Deterministic** — same metrics always produce same decisions
- **Low‑latency** — decision latency < 50ms
- **Fully observable** — structured JSON logs and Prometheus metrics
- **Multi‑window** — 1m, 5m, 30m burn‑rate windows
- **Fail‑safe** — conservative enforcement (prefer abort over continue)

## SLO Domains

1. **Latency SLOs** — p95 < 50ms, p99 < 80ms
2. **Error‑Rate SLOs** — < 0.5% (1m), < 0.3% (5m), < 0.1% (30m)
3. **Saturation SLOs** — CPU, Memory, Queue, Threads
4. **Global Rules** — all SLOs must be met for M2 readiness
