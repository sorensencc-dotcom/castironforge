# WS-D: Fire Drills — Overview

The Fire‑Drill subsystem is the resilience‑validation layer for CIC.
It executes controlled failure scenarios to verify that the system behaves deterministically under stress, degradation, and governance‑triggered abort conditions.

## Purpose

Fire‑drills are serial and run only after Workstreams A, B, and C are green.
They validate:

- **Budget exhaustion** — rapid token/cost consumption triggers abort
- **SLO burn‑rate spikes** — latency/error spikes trigger canary rollback
- **Adapter degradation** — slow/failed adapters are contained and cached
- **Canary rollback correctness** — rollback is fast and state-consistent
- **Fail‑open / fail‑closed behavior** — safety guarantees hold under failure

## Execution Model

Fire‑drills are the **final gate before M2 promotion**.
All scenarios must pass with deterministic, reproducible outcomes.

## Key Properties

- **Serial execution** — no parallel scenarios
- **Deterministic** — same inputs always produce same outputs
- **Observable** — structured JSON logs capture all events
- **Fast rollback** — < 300ms target, < 500ms hard ceiling
- **Clean state** — no partial state, no stale caches after each drill
