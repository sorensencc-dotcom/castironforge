# CIC v3.1 Implementation Blueprint
# v3.1.0 | 2026-05-30 | PROPOSED
# Title: Adaptive Intelligence Expansion

## 1. Objective
Translate the v3.1 roadmap into a buildable system by defining the file structure, module contracts, and integration points for the Model Portfolio, Drift Engine, and Dynamic Policy Reloading pillars.

---

## 2. Filesystem Layout (New & Updated)
```
cic-ingestion/
  src/
    control_plane/
      models/
        LOCAL.json
        FLASH.json
        PRO.json
      registry/
        ModelRegistry.ts
        ModelHealth.ts
        ABHarness.ts
    drift/
      DriftEngineV2.ts
      DriftProfile.ts
      DriftSignals.ts
      DriftTelemetry.ts
    policy/
      PolicyEngine.ts      (updated)
      PolicyWatcher.ts     (new)
      PolicySandbox.ts     (new)
    router/
      RouterAgent.ts       (updated)
    orchestrator/
      Orchestrator.ts      (updated)
control_plane/
  models/
    LOCAL.json
    FLASH.json
    PRO.json
  policies/
    default/policy.json
    strict/policy.json
tests/
  models/
    model_registry_golden.test.js
    model_ab_golden.test.js
  drift/
    drift_engine_golden.test.js
  policy/
    policy_reload_golden.test.js
```

---

## 3. Pillar 1: Model Portfolio Registry
- **ModelRegistry.ts**: Loads tier definitions, validates schemas, and provides weighted engine selection.
- **ABHarness.ts**: Implements weighted random selection, canary mode, and kill-switches.
- **ModelHealth.ts**: Tracks p95 latency, error rates, and costs to trigger rebalancing.
- **JSON Schema**: Tier definitions (`PRO.json`, etc.) specify engine weights and health constraints.

---

## 4. Pillar 2: Drift Engine v2
- **DriftEngineV2.ts**: Analyzes task payloads and model outputs to generate drift scores and signals (semantic, style, hallucination, safety).
- **DriftProfile.ts**: Defines subsystem-specific drift tolerances.
- **DriftTelemetry.ts**: Emits granular events (`drift.start`, `drift.spike`, `drift.quarantine`) for observability.
- **RouterAgent v2.4 Integration**: The RouterAgent will be upgraded to incorporate drift-weighted entropy and cost adjustments.

---

## 5. Pillar 3: Dynamic Policy Reloading
- **PolicyWatcher.ts**: Monitors policy files for changes and triggers hot reloads with schema validation.
- **PolicySandbox.ts**: Enables testing policies against historical or synthetic tasks in a shadow routing mode.
- **PolicyEngine v3.1 Updates**: Gains hot reload support, dynamic drift ceilings, and automated rollback capabilities.

---

## 6. Core Component Updates
- **Orchestrator v3.1**: Integrates the ModelRegistry, A/B Harness, and DriftEngine into the execution flow, making it the central authority for applying adaptive logic.
- **Inference Clients**: Updated to receive `engine_id` and emit model-specific telemetry.

---

## 7. Golden Test Suites (New)
- **Model Registry & A/B**: Verifies deterministic weighted selection, kill-switch behavior, and canary routing.
- **Drift Engine**: Validates detection of semantic, style, hallucination, and safety drift.
- **Policy Reload**: Ensures reload success/failure, diff correctness, and rollback triggers.

---

## 8. Release Checklist
- **Core**: Implement ModelRegistry, ABHarness, DriftEngineV2, and PolicyWatcher.
- **Tests**: Implement 3 new golden test suites with 100% pass rate.
- **Telemetry**: Add 12 new events for model selection and drift.
- **Docs**: Create `CIC_CONTROL_PLANE_ARCHITECTURE_v3.1.md`, `CIC_DRIFT_ENGINE_v2_SPEC.md`, and `CIC_MODEL_REGISTRY_SPEC_v1.md`.
