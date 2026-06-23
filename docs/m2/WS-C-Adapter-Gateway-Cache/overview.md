# WS-C: Adapter Gateway Cache — Overview

The Adapter Gateway Cache is the latency‑stabilization and load‑absorption layer for CIC.
It provides deterministic caching for upstream adapter responses, reduces p95/p99 latency, prevents stampede behavior, and ensures stable performance during canary evaluation and fire‑drills.

## Purpose

The cache subsystem implements:

- **L1 in‑memory caching** — ultra-low latency (< 1ms) per-process
- **L2 distributed caching** — consistent across nodes (1-5ms latency)
- **Cache invalidation rules** — time-based, event-based, dependency-based
- **Cache key strategy** — deterministic key generation
- **Stampede prevention** — request coalescing, single-flight locks
- **Latency + hit‑rate metrics** — observability for SLO enforcement

## Integration Points

The Adapter Gateway Cache integrates with:

- **Adapter Gateway** — upstream adapter abstraction
- **SLO Controller** — cache hit-rate triggers enforcement
- **Budget Ledger** — invalidation on governance events
- **Fire Drills** — adapter degradation scenarios
- **Prometheus** — metrics export and alerting

## Key Properties

- **Deterministic** — same key always returns same value (within TTL)
- **Stable** — maintains performance under sustained and burst load
- **Correct** — no stale entries beyond TTL; invalidation propagates
- **Observable** — complete metrics (hit-rate, latency, stampedes)
- **Resilient** — degrades gracefully when upstream fails

## Performance Targets

- **Hit-rate** — ≥ 85%
- **Lookup latency p95** — < 8ms
- **Lookup latency p99** — < 15ms
- **Stampede events** — 0 (no tolerance)
- **Stale entries** — 0 beyond TTL (no tolerance)
