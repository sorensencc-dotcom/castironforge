# CIC Mesh Reliability Model

The CIC Mesh is a distributed, spec-driven reliability controller. It frames engineering operations as a closed-loop system where disturbances (tool failures, LLM hallucinations, retrieval drift) are detected, diagnosed, and corrected via feedback loops.

## System as a Controlled Process

### Plant
The multi-agent CIC mesh executing workflows:
- PR review → code quality assurance
- Failure diagnosis → repair and recovery
- Roadmap harvesting → continuous improvement
- Nightly evaluation → regression detection

### Controller (Orchestrator)
The Node 20 dispatcher + WorkflowExecutor + AgentRunner + HITL gates:
- Loads specs deterministically
- Orchestrates step execution via DAG
- Invokes Claude agents with validated outputs
- Enforces human approval on high-risk actions

### Disturbances
Real-world faults that challenge the system:
- Tool call failures (Anthropic API timeouts, network errors)
- LLM hallucinations (JSON output that doesn't match schema)
- Retrieval drift (stale indexes; outdated incident context)
- Runtime outages (CIC cluster unavailable; edge node network loss)
- Webhook noise (duplicate events; out-of-order deliveries)

### Goal
Keep the mesh in a safe, productive operating region despite disturbances:
- Successful workflow completions
- Correct CIC builds
- Validated repairs
- Updated roadmap
- Fresh retrieval indexes

## State and Error Signals

### State Vector (x(t))
The system state at time t:

```
x(t) = {
  workflow_progress,        # per-step completion status
  agent_health,             # success rates, latency metrics
  retrieval_freshness,      # index age, vector drift
  build_status,             # success/failure counts
  error_counters,           # failures by type
  roadmap_version           # last update timestamp
}
```

### Control Input (u(t))
Decisions made by the orchestrator:

```
u(t) = {
  which_workflow_to_run,    # triggered by GitHub event
  which_agent_to_call,      # loaded from agents/index.yaml
  whether_to_repair,        # risk_level-based HITL gate
  whether_to_escalate,      # medium/high-risk actions
  index_rebuild_schedule    # nightly trigger
}
```

### Error Signal (e(t))
Difference between desired and actual behavior:

```
e(t) = ||desired_outcome - actual_outcome||

where:
  desired_outcome = {
    success: true,
    latency: < SLA,
    correctness: high_confidence,
    safety: no_unapproved_mutations
  }

  actual_outcome = {
    success: workflow.status,
    latency: elapsed_time,
    correctness: agent_confidence,
    safety: hitl_gates_enforced
  }
```

## Closed-Loop Reliability Mechanisms

### Feedback Path 1: Build Loop

```
GitHub PR Event
    |
    v
pr_review_pipeline
    |
    +---> review output
    +---> test results
    +---> cic_build status
    |
    v
roadmap_harvester
    |
    v
roadmap update (HITL approval required)
```

**Effect**: Every PR contributes code + ideas. Feedback helps prioritize future work.

### Feedback Path 2: Failure Loop

```
cic.build.failed Event
    |
    v
failure_triage
    |
    v
diagnosis (failure_type, suspected_root_cause, confidence)
    |
    v
repair_planner
    |
    v
repair_plan (risk_level, requires_hitl)
    |
    v
[HITL Gate: medium/high-risk?]
    |
    +---> No:  repair_executor (low-risk auto-repair)
    +---> Yes: awaiting_approval (operator decides)
    |
    v
roadmap_harvester
    |
    v
roadmap update (HITL approval required)
```

**Effect**: Failures become learning opportunities. Repairs are validated. Future similar failures are easier to resolve.

### Feedback Path 3: Retrieval Loop

```
Every Night (0 3 * * *)
    |
    v
edge_node_nightly_eval
    |
    +---> eval_runner (agent/extractor/retrieval tests)
    +---> index_rebuilder (BM25 + vectors + RRF)
    +---> roadmap_feeder (regressions → ideas)
    |
    v
roadmap_harvester
    |
    v
roadmap update (HITL approval required)
```

**Effect**: System improves continuously. Regressions are caught early. Indexes stay fresh.

## Reliability as Bounded Control

### Optimization Problem

For each workflow, choose a control policy π to:

```
minimize:  E[failure_rate | policy=π]
subject to:
  - time_budget ≤ T_max
  - token_budget ≤ K_max
  - risk_level ≤ HITL_threshold (enforced at gate)
  - dependency_violations = 0 (DAG guarantees)
```

### Control Policies

**PR Review Pipeline**:
- DAG: review, tests, cic_build (parallel) → harvest → synthesize (HITL) → summary
- Bounds: per-step timeouts, max retries on API failure
- Risk: code review is observational; synthesis requires approval

**Failure Diagnosis**:
- DAG: triage → plan_repair → [HITL if medium/high] → execute → summary
- Bounds: low-risk repairs execute immediately; medium/high require approval
- Risk: repair_executor only runs `cic.restart` and `cic.snapshot` on low-risk actions

**Roadmap Harvesting**:
- DAG: harvest (normalize + score) → synthesize (merge) → [HITL] → summary
- Bounds: no direct mutations; all changes require approval
- Risk: version bump gated; rollback is a PR revert

**Edge-Node Nightly Eval**:
- DAG: eval_runner → index_rebuilder → roadmap_feeder (all sequential)
- Bounds: long-running but sandboxed; failures don't affect cluster
- Risk: fully automated; failures logged but don't block anything

## Emergent Reliability Properties

### 1. Fault Containment
When a workflow step fails:
- Error is logged with full context (agent_id, input, step_id)
- Failure triggers `cic_failure_diagnosis` workflow (if applicable)
- No cascading failures; each step is isolated

Example:
```
pr_review_pipeline[review].invoke fails
    → logged: {"level":"error", "agent_id":"pr_reviewer", "error":"..."}
    → on next cic.build.failed: failure_triage retrieves similar incidents
    → diagnosis informs repair_planner
```

### 2. Graceful Degradation
The two-profile system allows:
- **cic_core**: event-driven, latency-critical → sized for peak load
- **edge_node**: long-running, evaluations → absorbs variability without affecting cluster

If edge node is slow:
- Nightly evals are delayed but don't block PR workflows
- Roadmap updates from failed evals are queued; HITL gate prevents stale merges

### 3. Self-Improvement
Roadmap Harvester closes the loop:
- Failures → repair history → future decision guidance
- Evals → regression detection → roadmap priority shift
- PRs → code quality feedback → standards enforcement

Over time, the system becomes more predictive (fewer failures) and more efficient (better prioritization).

### 4. Predictability
Every aspect is deterministic:
- DAG order is reproducible from YAML
- Agent outputs are JSON (structured, parseable)
- Templates resolve the same way every time
- HITL gates are explicit conditions

Reproducibility = auditability = trustworthiness.

## Concrete Metrics

To operationalize reliability, track:

| Metric | Definition | Target |
|---|---|---|
| **Workflow Success Rate** | successful_completions / total_triggers | > 95% |
| **MTTR (Mean Time to Repair)** | time from failure to repair completion | < 30 min |
| **Retrieval Freshness** | time since last index rebuild | < 24 hr |
| **Agent Latency (p99)** | 99th percentile of agent invocation time | < 10 sec |
| **HITL Approval Time** | time from awaiting_approval to human decision | < 1 hr (SLA) |
| **Roadmap Staleness** | days since last roadmap version bump | < 7 days |
| **False Positive Rate** | repairs that didn't fix the failure | < 5% |

## Example Scenario: A Failure Occurs

1. **0:00** — CIC build fails (extractor timeout)
   ```
   cic.build.failed event triggers cic_failure_diagnosis workflow
   ```

2. **0:01** — failure_triage diagnoses
   ```
   - failure_type: extractor
   - suspected_root_cause: query timeout (90s exceeded)
   - confidence: 0.87
   - related_incidents: ["2026-06-16 extractor timeout", ...]
   ```

3. **0:02** — repair_planner plans
   ```
   - actions: [
       {step: "1", tool: "cic.snapshot", args: {...}},
       {step: "2", tool: "cic.restart", args: {component: "extractors"}}
     ]
   - risk_level: low
   - requires_hitl: false
   ```

4. **0:03** — repair_executor executes (no gate)
   ```
   - executed_actions: ["snapshot", "restart"]
   - status: success
   ```

5. **0:05** — roadmap_feeder generates
   ```
   - new_idea: "Increase extractor query timeout to 120s"
   - category: Infra
   - urgency: medium
   - impact: 3
   ```

6. **0:06** — roadmap_harvester normalizes and scores
   ```
   - roadmap_delta created
   ```

7. **0:07** — roadmap_synthesizer prepares merge
   ```
   - roadmap_draft ready for approval
   ```

8. **0:07** — HITL gate blocks
   ```
   awaiting_approval: "Approve roadmap changes derived from this failure"
   ```

9. **0:30** — Human approves
   ```
   roadmap version 47 → 48
   "extractor timeout" issue linked to repair action
   ```

**Result**: System learned. Next similar failure will be diagnosed faster (via retrieval). Next deployment will include the timeout increase.

This is closed-loop engineering, not incident management.
