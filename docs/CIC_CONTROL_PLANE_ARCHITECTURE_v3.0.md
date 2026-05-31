# CIC Control Plane Architecture v3.0
# v3.0.0 | 2026-05-30 | ACTIVE
# Scope: Governance → Routing → Execution → Telemetry

## 1. Objective
Provide a deterministic, multi-tenant, policy-driven control system for CIC's hybrid inference network. The control plane ensures that every inference task is governed by operator intent, safety constraints, and cost envelopes before execution.

---

## 2. High-Level Architecture

```
[ CIC Agent ]
      |
      v
[ POLICY ENGINE v3.0 ]  ← Governance Layer (Rules, Safety, Cost)
      |
      v
[ ROUTER AGENT v2.3 ]   ← Routing Layer (Deterministic Tier Selection)
      |
      v
[ ORCHESTRATOR v2.3 ]   ← Execution Layer (Lifecycle, Fallback)
      |
      v
[ Inference Clients ]    ← Engines (Local, Flash, Pro, Fallback)
      |
      v
[ Result Artifact ]
```

---

## 3. Layer Responsibilities

### 3.1 Policy Layer (v3.0) — Governance
- **Authoritative Rules**: Enforces tenant-level overrides (e.g., "Always use CLOUD_PRO for Redesign").
- **Safety Perimeter**: Blocks high-risk tasks or escalates them based on `SafetyLevel`.
- **Resource Guardrails**: Applies cost ceilings (entropy modification) and latency caps.
- **Multi-Tenancy**: Loads declarative policies from `control_plane/policies/<tenant>/policy.json`.

### 3.2 Routing Layer (v2.3) — Tier Selection
- **Entropy Tiering**: Maps task complexity to inference tiers (L0, L1, C1, C2).
- **Drift Protection**: Forces `LOCAL_FALLBACK` if drift scores exceed 0.35.
- **Dynamic Overrides**: Switches tiers based on real-time p95 latency and budget modes.
- **Confidence Control**: Assigns task-specific thresholds for escalation.

### 3.3 Execution Layer (Orchestrator v2.3) — Action
- **Single Execution Path**: Unified interface for all inference requests.
- **Contract Enforcement**: Ensures all flows obey Policy and Routing decisions.
- **Resilience**: Implements automatic fallback on model/network errors.
- **Telemetry Emission**: Emits granular audit events for every step.

---

## 4. Deterministic Data Flow

1.  **Request**: CIC Agent submits a task to the Orchestrator.
2.  **Context**: Orchestrator builds `RouteRequest` (signals) and `RouteContext` (metrics).
3.  **Governance**: `PolicyEngine` evaluates the request. It may block the task, force a specific target, or modify request parameters.
4.  **Routing**: `RouterAgent` selects the optimal tier based on the (potentially modified) request and real-time context.
5.  **Execution**: Orchestrator invokes the selected `InferenceClient`.
6.  **Telemetry**: Parallel to all steps, the system emits a 10-event audit trail to the `GovernanceBus`.

---

## 5. Multi-Tenant Model
Tenant policies are declarative JSON files allowing operators to change system behavior without code updates:
- **Overrides**: Force or deny specific model targets per subsystem.
- **Safety**: Define blocking levels or escalation triggers.
- **Cost**: Set entropy thresholds for local-first preference.
- **Latency**: Set p95 ceilings for automatic tier switching.

---

## 6. Verification & Stability (Golden Suites)
- **Routing Golden Suite**: 8 canonical cases validating entropy, drift, and latency logic.
- **Policy Golden Suite**: 8 canonical cases validating overrides, safety blocks, and budget caps.
- **Continuous Integration**: CI must pass all golden tests to ensure determinism never regresses.

---

## 7. Telemetry & Audit Trail
The system emits the following canonical events:
- **Policy**: `policy.start`, `policy.override`, `policy.rule.applied`, `policy.block`, `policy.final`.
- **Routing**: `routing.start`, `routing.local.attempt`, `routing.cloud.attempt`, `routing.fallback.trigger`, `routing.decision.final`.

---
**Status: CIC v3.0 Control Plane Infrastructure Locked.**
