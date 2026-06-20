# CIC Mesh Operator Handbook
**Cooperative Intelligence Cluster — Operational Reference**

| Field | Value |
|---|---|
| Version | 1.0.0 PUBLICATION READY |
| Date | June 2026 |
| Audience | Platform Engineers · AI Ops · System Administrators |
| Classification | Internal Operational Reference |
| Related Document | CIC Mesh v1.0 Whitepaper |
| Owner | Platform Engineering / AI Operations |

## Version History

| Version | Date | Author | Change Summary |
|---|---|---|---|
| 0.1 | Jan 2026 | Platform Engineering | Initial operator procedures; basic workflow triggering guide. |
| 0.2 | Feb 2026 | AI Ops Team | Added HITL procedures and log interpretation guide. |
| 0.3 | Mar 2026 | Senior Mesh Ops | Added troubleshooting guide and agent addition procedures. |
| 0.4 | Apr 2026 | Mesh Architects | Added safety and rollback processes; runtime profile management. |
| 1.0 | Jun 2026 | All Contributors | Full publication pass: all sections complete, reviewed, and approved. |

---

## Table of Contents

- Preface
- [Chapter 1: Operator Roles and Responsibilities](#chapter-1-operator-roles-and-responsibilities)
- [Chapter 2: System Overview for Operators](#chapter-2-system-overview-for-operators)
- [Chapter 3: Workflow Triggering and Management](#chapter-3-workflow-triggering-and-management)
- [Chapter 4: HITL (Human-in-the-Loop) Procedures](#chapter-4-hitl-human-in-the-loop-procedures)
- [Chapter 5: Log Interpretation](#chapter-5-log-interpretation)
- [Chapter 6: Troubleshooting Guide](#chapter-6-troubleshooting-guide)
- [Chapter 7: Adding New Agents and Workflows](#chapter-7-adding-new-agents-and-workflows)
- [Chapter 8: Runtime Profile Management](#chapter-8-runtime-profile-management)
- [Chapter 9: Safety Procedures and Rollback](#chapter-9-safety-procedures-and-rollback)
- [Chapter 10: Maintenance Operations](#chapter-10-maintenance-operations)
- [Appendix A: Quick Reference Card](#appendix-a-quick-reference-card)
- [Appendix B: CLI Command Reference](#appendix-b-cli-command-reference)
- [Appendix C: Alert Runbook Index](#appendix-c-alert-runbook-index)
- [Appendix D: Change Control Templates](#appendix-d-change-control-templates)
- [Appendix E: Incident Report Template](#appendix-e-incident-report-template)
- [Appendix F: HITL Gate Decision Reference](#appendix-f-hitl-gate-decision-reference)
- [Appendix G: Operator Onboarding Checklist](#appendix-g-operator-onboarding-checklist)
- [Appendix H: Glossary](#appendix-h-glossary)

---

## Preface

This handbook is the primary operational reference for all personnel responsible for deploying, monitoring, and maintaining the CIC Mesh — the Cooperative Intelligence Cluster cooperative multi-agent AI system. It is written for three primary audiences: Platform Engineers who own infrastructure and deployment pipelines, AI Operations teams who manage day-to-day mesh health and incident response, and System Administrators who manage credentials, access control, and connector integrations.

For architectural design decisions, agent capability definitions, and system design rationale, refer to the CIC Mesh v1.0 Whitepaper. This handbook focuses exclusively on operational practice — what to do, how to do it, and when to escalate.

### How to Use This Handbook

Chapters 1–2 establish roles and system context. Chapters 3–5 cover daily operational tasks: triggering workflows, resolving HITL gates, and interpreting logs. Chapters 6–9 cover reactive operations: troubleshooting, adding agents, managing runtime profiles, and safety/rollback procedures. Chapter 10 covers routine maintenance. Appendices serve as desk-reference material for experienced operators.

New operators should read Chapters 1–5 in full before their first solo shift. Experienced operators should bookmark Appendix A (Quick Reference Card) and Chapter 6 (Troubleshooting). All operators should be familiar with Chapter 9 (Safety Procedures) before any production access is granted.

### Conventions Used in This Handbook

> **ⓘ NOTE** — Informational context that helps you make better decisions. Not urgent.

> **⚠ WARNING** — Action that can cause workflow interruption, data loss, or service degradation if performed incorrectly. Read carefully before proceeding.

> **⚠ CRITICAL** — Action that can cause irreversible consequences, safety incidents, or production outages. Requires explicit authorization before proceeding.

### On-Call Contact Escalation Path

| Severity | First Contact | Escalate To | Final Escalation |
|---|---|---|---|
| P1 (Critical) | L1 Mesh Operator (on-call) | L2 Senior Operator within 15 min | L3 Mesh Architect + AI Safety Officer |
| P2 (High) | L1 Mesh Operator (on-call) | L2 Senior Operator within 1 hour | L3 Mesh Architect as needed |
| P3 (Medium) | L1 Mesh Operator (next available) | L2 within 4 hours | L3 at discretion |
| P4 (Low) | L1 Operator next business day | L2 as needed | — |

---

## Chapter 1: Operator Roles and Responsibilities

### 1.1 Role Definitions

#### Mesh Operator (L1)

The Mesh Operator is the first responder for all operational alerts. L1 operators monitor dashboards continuously during their shift, acknowledge HITL gates within defined SLA windows, execute standard runbooks without modification, and escalate to L2 when an issue cannot be resolved within their access or competency scope.

- Monitor operational dashboards and alert queues
- Acknowledge and resolve HITL gates (Tiers: Informational, Confirmational)
- Execute standard runbooks for known failure patterns
- Escalate to L2 within defined SLA (P1: 15 min, P2: 1 hour)
- Log all actions taken in the incident management system

**Access Level:** Read (all dashboards and logs) + HITL gate resolution + workflow restart (from checkpoint only)

#### Senior Mesh Operator (L2)

Senior Operators own incident response for P1 and P2 events. They perform deep log analysis, conduct root cause investigations, and are authorized to make configuration changes under active change control. L2 operators manage runtime profile switches and can restart individual agent pods.

- Lead P1/P2 incident response end-to-end
- Perform log analysis and root cause identification
- Execute configuration changes with approved change ticket
- Manage runtime profile switches (workflow-scoped and global default with approval)
- Authorize agent soft restart and failover

**Access Level:** All L1 permissions + config write (change-controlled) + runtime profile change + agent restart

#### Mesh Architect (L3)

Mesh Architects are responsible for the structural integrity of the mesh. They approve new agent onboarding, review and approve workflow definition changes, own retrieval configuration and runtime profile definitions, and provide final technical sign-off on all changes to the safety and compliance stack.

- Approve new agent onboarding requests (design review)
- Design and review workflow changes
- Own retrieval config and runtime profile definitions
- Provide sign-off for security and compliance changes
- On-call escalation for P1 events when L2 cannot resolve

**Access Level:** Full administrative access across all mesh subsystems

#### AI Safety Officer

The AI Safety Officer is a specialized role with authority scoped specifically to the safety configuration of the mesh. This role reviews and approves all changes to SafetyGateAgent policies, owns the definitions of HITL tier thresholds, and approves any modification to confidence thresholds that affect the safety gate. This role does not have general administrative access.

- Review and approve all SafetyGateAgent policy changes
- Own and update HITL tier definitions
- Approve changes to confidence thresholds at the safety gate
- Participate in post-incident reviews for safety-related incidents
- Co-approve agent onboarding for agents with HITL interactions

**Access Level:** Safety config write (scoped to safety subsystem only); read access to all audit logs

### 1.2 Responsibility Matrix (RACI)

`R = Responsible    A = Accountable    C = Consulted    I = Informed`

| Activity | L1 Operator | L2 Sr. Operator | L3 Architect | AI Safety Officer | Platform Eng. |
|---|---|---|---|---|---|
| Incident response (P1/P2) | R | A | C | I | I |
| Incident response (P3/P4) | A/R | I | I | — | I |
| HITL gate resolution | R | A | I | C | — |
| Workflow restart | R | A | I | — | — |
| Agent onboarding | I | C | A/R | C | R |
| Retrieval config change | — | C | A/R | I | R |
| Runtime profile change | I | R | A | I | C |
| Model update | I | C | A | C | R |
| Safety config change | — | I | C | A/R | R |
| Compliance audit | I | C | A | R | C |
| On-call rotation management | C | A/R | I | — | I |

### 1.3 On-Call Expectations

The on-call rotation covers 24/7/365 with a minimum of one L1 operator and one L2 operator reachable at all times. Rotations are typically 1-week blocks. Handoff occurs at 08:00 local time on the shift boundary day.

#### Escalation SLAs

| Priority | Definition | L1 Acknowledge | L2 Engage | Resolution Target |
|---|---|---|---|---|
| P1 — Critical | Production mesh down or safety incident | 5 min | 15 min | 1 hour |
| P2 — High | Significant workflow failure or HITL backlog | 15 min | 1 hour | 4 hours |
| P3 — Medium | Degraded performance, non-critical agent issues | 1 hour | 4 hours | Next business day |
| P4 — Low | Cosmetic, logging, or advisory issues | Next business day | As needed | Within 1 week |

#### Handoff Procedure

1. Outgoing operator documents all open incidents, pending HITL gates, and ongoing investigations in the handoff log.
2. Outgoing operator verbally briefs incoming operator (or asynchronously via handoff note if remote).
3. Incoming operator acknowledges all open items in the handoff system before outgoing operator goes off-call.
4. On-call pager transfer is executed via the on-call management platform (confirm transfer was received).

### 1.4 Access Control and Least Privilege

All mesh operator access is role-based and scoped to the minimum permissions required to perform assigned duties. Access is provisioned by Platform Engineering upon receipt of a completed onboarding request approved by an L3 Architect.

| Permission | L1 | L2 | L3 | Safety Officer |
|---|---|---|---|---|
| Read dashboards & logs | Yes | Yes | Yes | Yes |
| HITL gate resolution | Yes | Yes | Yes | Consult only |
| Workflow restart (checkpoint) | Yes | Yes | Yes | No |
| Configuration write | No | Change-controlled | Yes | Safety scope only |
| Agent restart | No | Yes | Yes | No |
| Runtime profile change | No | Yes | Yes | No |
| Safety config write | No | No | Approve only | Yes |
| Full admin | No | No | Yes | No |

**MFA Enforcement:** Multi-factor authentication is mandatory for all operator accounts. MFA challenges are required at login and re-prompted for all privileged actions (config write, agent restart, safety config change).

**Audit Logging:** All privileged actions are recorded in the immutable audit log with: operator ID, action taken, target resource, associated ticket ID, and timestamp. Audit logs are retained for 2 years and reviewed monthly.

> **⚠ CRITICAL — Break-Glass Procedure**
>
> If normal access systems are unavailable during a P1 incident, break-glass emergency credentials are stored in the secure vault (location defined in the separate Break-Glass Runbook). Use requires dual authorization (two L2+ operators) and generates an automatic P1 incident ticket. All break-glass use must be reviewed within 24 hours.

### Chapter 1 Summary

- Four operator roles: L1 (first responder), L2 (incident owner), L3 (architect/approver), AI Safety Officer (safety-scoped).
- RACI matrix defines who is responsible, accountable, consulted, and informed for every major activity.
- P1 escalation SLA: L1 acknowledges in 5 min, L2 engages within 15 min.
- All access is least-privilege and role-based; MFA and audit logging are mandatory for all privileged actions.

---

## Chapter 2: System Overview for Operators

### 2.1 Mesh Topology Quick Reference

The CIC Mesh is organized in four horizontal tiers communicating via a central event bus. Each tier is described below, followed by the ASCII topology diagram suitable for desk reference. For full architectural details, refer to the CIC Mesh v1.0 Whitepaper.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ORCHESTRATOR LAYER                           │
│   ┌──────────────────────┐  ┌──────────────────┐  ┌─────────────┐  │
│   │  MasterOrchestrator  │  │  IntentPlanner   │  │TaskGraphBld │  │
│   └──────────┬───────────┘  └────────┬─────────┘  └──────┬──────┘  │
└──────────────┼──────────────────────┼────────────────────┼─────────┘
               │         ┌────────────┴──────────┐         │
               └────────►│   EVENT BUS (pub/sub) │◄────────┘
                          └────────────┬──────────┘
               ┌─────────────────────────────────────────────┐
               │          PLANNER / EXECUTOR TIER             │
               │  ┌────────────┐  ┌────────────┐  ┌────────┐ │
               │  │ResearchAgt │  │WritingAgent│  │CodeAgt │ │
               │  └────────────┘  └────────────┘  └────────┘ │
               │  ┌────────────┐  ┌────────────┐  ┌────────┐ │
               │  │AnalystAgt  │  │SchedulerAgt│  │DocAgt  │ │
               │  └────────────┘  └────────────┘  └────────┘ │
               └─────────────────────────────────────────────┘
                          │                      │
               ┌──────────┴──────────────────────┴──────────┐
               │           SAFETY & REVIEW LAYER             │
               │   ReviewerAgent ──► SafetyGateAgent          │
               │              └──► HITL Gate ◄── Operator    │
               └────────────────────────────────────────────┘
                          │                      │
    ┌─────────────────────┴──────┐  ┌────────────┴────────────────┐
    │      RETRIEVAL LAYER       │  │       CONNECTOR LAYER        │
    │ VectorStore ◄► EmbeddingEng│  │  Email │ Calendar │ Files    │
    │ KnowledgeBase │ IndexMgr   │  │  CRM   │ ExtAPIGW │ WebHooks │
    └────────────────────────────┘  └─────────────────────────────┘
```

### 2.2 Key Components Quick Reference

| Component | Function | Infrastructure Location | Health Check | Restart Command | Log Location |
|---|---|---|---|---|---|
| MasterOrchestrator | Top-level workflow coordination | orchestrator-ns / pod: master-orch | `cic-mesh agent status --id MasterOrchestrator` | `cic-mesh agent restart --id MasterOrchestrator` | /logs/orchestrator/ |
| IntentPlanner | Parses user intent into task plan | orchestrator-ns / pod: intent-planner | `cic-mesh agent status --id IntentPlanner` | `cic-mesh agent restart --id IntentPlanner` | /logs/orchestrator/ |
| TaskGraphBuilder | Builds execution graph from plan | orchestrator-ns / pod: task-graph | `cic-mesh agent status --id TaskGraphBuilder` | `cic-mesh agent restart --id TaskGraphBuilder` | /logs/orchestrator/ |
| ResearchAgent | Web and knowledge base retrieval | executor-ns / pod: research-agent | `cic-mesh agent status --id ResearchAgent` | `cic-mesh agent restart --id ResearchAgent` | /logs/agents/research/ |
| WritingAgent | Content generation and drafting | executor-ns / pod: writing-agent | `cic-mesh agent status --id WritingAgent` | `cic-mesh agent restart --id WritingAgent` | /logs/agents/writing/ |
| CodeAgent | Code generation and execution | executor-ns / pod: code-agent | `cic-mesh agent status --id CodeAgent` | `cic-mesh agent restart --id CodeAgent` | /logs/agents/code/ |
| ReviewerAgent | Quality and accuracy review | review-ns / pod: reviewer | `cic-mesh agent status --id ReviewerAgent` | `cic-mesh agent restart --id ReviewerAgent` | /logs/review/ |
| SafetyGateAgent | Policy enforcement and HITL trigger | safety-ns / pod: safety-gate | `cic-mesh agent status --id SafetyGateAgent` | Requires L3 authorization | /logs/safety/ |
| Event Bus | Pub/sub message routing between agents | infra-ns / pod: event-bus | `cic-mesh mesh event-bus status` | Platform Engineering only | /logs/eventbus/ |
| VectorStore | Retrieval index storage | retrieval-ns / pod: vector-store | `cic-mesh retrieval health` | Platform Engineering only | /logs/retrieval/ |
| ConnectorGateway | External service integration | connector-ns / pod: connector-gw | `cic-mesh connector status --all` | `cic-mesh connector restart --id <id>` | /logs/connectors/ |

### 2.3 Normal Operating State

Use the following thresholds to determine if the mesh is in a healthy operating state. Deviations from these baselines warrant investigation even if no alert has fired.

| Indicator | Healthy Threshold | Warning Threshold | How to Verify |
|---|---|---|---|
| Circuit breakers | All CLOSED | Any HALF-OPEN | `cic-mesh mesh circuit-breakers` |
| Pending HITL gates >1h | Zero | >3 gates | `cic-mesh hitl list --status PENDING --older-than 1h` |
| Workflow success rate | >97% | <95% | Dashboard → Workflow SLO panel |
| Retrieval P95 latency | <500ms | >800ms | Dashboard → Retrieval Latency panel |
| Event bus queue depth | <100 messages | >500 messages | `cic-mesh mesh event-bus queue-depth` |
| Agent heartbeat | All agents reporting within 30s | Any agent silent >60s | `cic-mesh agent list --heartbeat-stale` |

### 2.4 Environment Inventory

| Environment | Purpose | Dashboard URL | Cluster Name | Default Profile | Access Restriction |
|---|---|---|---|---|---|
| PROD | Live production traffic | ops.cic-mesh.internal/prod | cic-prod-01 | BALANCED | L1+ with MFA; all changes change-controlled |
| STAGING | Pre-release validation; shadow traffic | ops.cic-mesh.internal/staging | cic-staging-01 | BALANCED | L2+ for config changes; L1 for monitoring |
| DEV | Development and integration testing | ops.cic-mesh.internal/dev | cic-dev-01 | FAST | Platform Engineering and L3 |
| SANDBOX | New agent onboarding and experimentation | ops.cic-mesh.internal/sandbox | cic-sandbox-01 | SAFE | L3 and approved engineers |

### Chapter 2 Summary

- The CIC Mesh has four tiers: Orchestrator, Planner/Executor, Safety & Review, and Retrieval/Connector.
- Healthy state thresholds: all circuit breakers CLOSED, workflow success >97%, retrieval P95 <500ms, event bus queue depth <100.
- Four environments: PROD, STAGING, DEV, SANDBOX — each with distinct access controls and runtime profile defaults.

---

## Chapter 3: Workflow Triggering and Management

### 3.1 How Workflows Are Triggered

| Trigger Type | Mechanism | Entry Point | Default Profile | Logging Notes |
|---|---|---|---|---|
| User Intent | Interactive user input via UI or API | IntentPlanner → TaskGraphBuilder | BALANCED | Full trace; user session ID attached |
| Scheduled (Cron) | Timer-based via Scheduler service | SchedulerAgent → MasterOrchestrator | SCHEDULED | Schedule ID and execution slot logged |
| Event-Driven | Webhook or inbound email event | ConnectorGateway → Event Bus | BALANCED | Source event ID logged; webhook payload archived |
| Operator-Initiated | Manual via CLI or API with operator credentials | CLI/API → MasterOrchestrator | Operator-specified | Operator ID, ticket reference, and rationale required |

### 3.2 Triggering a Workflow via CLI

```bash
# Syntax
cic-mesh workflow trigger \
  --intent "..." \
  --profile BALANCED \
  --workflow-id <generated-or-specified> \
  --dry-run  # optional: validate without executing

# Example: Trigger a research workflow
cic-mesh workflow trigger \
  --intent "Research AI regulation landscape in EU 2026 and produce summary report" \
  --profile THOROUGH \
  --notify-on-complete \
  --ticket OPS-1234

# Check status of a specific workflow
cic-mesh workflow status --id wf-a1b2c3d4

# List all actively executing workflows
cic-mesh workflow list --status EXECUTING

# List all workflows triggered today
cic-mesh workflow list --since today
```

> **ⓘ NOTE** — Always include `--ticket` when triggering operator-initiated workflows in PROD. This associates the workflow with your change or incident ticket and is required for audit compliance.

### 3.3 Triggering a Workflow via API

```http
POST /api/v1/workflows
Authorization: Bearer <token>
Content-Type: application/json

{
  "intent": "Generate a weekly executive summary of all completed research tasks",
  "profile": "BALANCED",
  "hitl_mode": "standard",
  "metadata": {
    "triggered_by": "operator",
    "ticket": "OPS-1234",
    "operator_id": "ops-user-09"
  }
}

# Success response (202 Accepted):
{
  "workflow_id": "wf-a1b2c3d4",
  "status": "QUEUED",
  "estimated_start_ms": 1200,
  "poll_url": "/api/v1/workflows/wf-a1b2c3d4/status"
}

# Error responses:
# 400 Bad Request — invalid profile or missing required field
# 401 Unauthorized — invalid or expired token
# 429 Too Many Requests — workflow queue at capacity
# 503 Service Unavailable — mesh in degraded state
```

### 3.4 Scheduling Recurring Workflows

```bash
# Create a new scheduled workflow
cic-mesh workflow schedule \
  --intent "Generate daily system health digest and email to ops-team@company.com" \
  --cron "0 8 * * 1-5" \
  --profile SCHEDULED \
  --name "DailyHealthDigest" \
  --timezone "America/New_York"

# List all scheduled workflows
cic-mesh schedule list

# Modify a schedule (cron expression)
cic-mesh schedule update --name DailyHealthDigest --cron "0 9 * * 1-5"

# Disable a schedule (without deleting)
cic-mesh schedule disable --name DailyHealthDigest

# Re-enable
cic-mesh schedule enable --name DailyHealthDigest

# Delete a schedule permanently
cic-mesh schedule delete --name DailyHealthDigest --confirm
```

> **⚠ WARNING** — Scheduled workflows run using the credentials of the service account assigned at creation time. Ensure that service account credentials are rotated per the credential rotation procedure (Section 10.4) to avoid scheduled workflow failures due to expired tokens.

### 3.5 Monitoring Workflow Progress

```bash
# Real-time status poll
cic-mesh workflow status --id wf-a1b2c3d4 --watch

# Stream live logs for a workflow
cic-mesh logs stream --workflow-id wf-a1b2c3d4

# Subscribe to workflow events on event bus
cic-mesh event-bus subscribe --topic workflow.wf-a1b2c3d4.events

# Dashboard
# Navigate to: ops.cic-mesh.internal/prod → Workflows → <workflow-id>
# The Workflow State Machine view shows all completed, active,
# and pending agent tasks as a dependency graph with timing.
```

Workflow states in order of execution: `QUEUED → PLANNING → EXECUTING → AWAITING_HITL → REVIEWING → COMPLETING → COMPLETED`

Failure states: `FAILED`, `CANCELLED`, `SUSPENDED`

### 3.6 Pausing, Resuming, and Cancelling Workflows

```bash
# Pause a workflow (preserves state at next agent boundary)
cic-mesh workflow pause --id wf-a1b2c3d4

# Resume a paused workflow
cic-mesh workflow resume --id wf-a1b2c3d4

# Cancel a workflow with required reason
cic-mesh workflow cancel --id wf-a1b2c3d4 \
  --reason "Operator initiated: duplicate request OPS-4321"
```

> **ⓘ NOTE** — `Pause` is safe at any time — the workflow preserves its current state and in-flight agent work is allowed to complete its current atomic step before pausing. `Cancel` halts at the next safe boundary and marks side effects for review. If a workflow has already sent emails, written files, or made external API calls, cancel does **not** reverse those actions. Use the side-effect reversal checklist in Section 9.4 when consequential actions have occurred.

### 3.7 Workflow Priority and Queuing

| Priority Level | Queue Position | Resource Allocation | When to Use | How to Set |
|---|---|---|---|---|
| CRITICAL | Head of queue, preemptive | Reserved pool | P1 incident response; safety workflows | `--priority CRITICAL` |
| HIGH | Front of queue | Priority allocation | Time-sensitive executive deliverables | `--priority HIGH` |
| NORMAL | Standard FIFO | Standard allocation | Default for all user-initiated workflows | Default |
| LOW | Back of queue; yields to all others | Idle capacity only | Background batch jobs, scheduled reports | `--priority LOW` |

```bash
# Elevate an in-progress workflow's priority
cic-mesh workflow update --id wf-a1b2c3d4 --priority HIGH --reason "Executive deadline"

# Monitor queue depth
cic-mesh workflow queue --status
```

### Chapter 3 Summary

- Workflows can be triggered via user intent, schedule (cron), event (webhook/email), or operator-initiated CLI/API call.
- Always include `--ticket` for operator-initiated PROD workflows to satisfy audit requirements.
- Pause preserves state safely; cancel halts execution but does not reverse side effects already completed.
- CRITICAL priority workflows preempt the queue and use reserved resource pools.

---

## Chapter 4: HITL (Human-in-the-Loop) Procedures

### 4.1 Understanding HITL Gates

HITL gates are mandatory human review checkpoints inserted into workflow execution by the SafetyGateAgent. They exist to ensure that consequential, uncertain, or policy-sensitive actions receive human oversight before execution proceeds. HITL gates are always in the critical path for consequential actions — no configuration or runtime profile can bypass them.

| Gate Tier | When Triggered | Operator Action | Resolution SLA | Who Can Resolve |
|---|---|---|---|---|
| INFORMATIONAL | Noteworthy event logged; no decision needed | Acknowledge receipt | 8 hours | L1+ |
| CONFIRMATIONAL | Action is ready; human must confirm before execution | Approve, reject, or modify | 4 hours | L1+ |
| BLOCKING | High-risk or policy-flagged action; workflow halted | Approve or reject; escalation may be required | 1 hour (P2) | L2+ (or AI Safety Officer for safety-flagged) |

### 4.2 Viewing Pending HITL Gates

```bash
# List all pending HITL gates across all workflows
cic-mesh hitl list --status PENDING

# List only BLOCKING tier gates (higher urgency)
cic-mesh hitl list --status PENDING --tier BLOCKING

# Filter by workflow
cic-mesh hitl list --workflow-id wf-a1b2c3d4

# Inspect full details of a specific gate
cic-mesh hitl inspect --gate-id gate-x1y2z3

# Sample output of hitl inspect:
# Gate ID:        gate-x1y2z3
# Workflow ID:    wf-a1b2c3d4
# Current State:  AWAITING_HITL
# Gate Tier:      CONFIRMATIONAL
# Pending Action: SEND_EMAIL
# Recipients:     finance-team@company.com
# Subject:        "Q2 2026 Budget Analysis"
# Risk Summary:   Low — recipient domain verified, no PII detected
# Data Scope:     Attachment: budget-analysis-q2.pdf (42KB)
# Gate Opened:    2026-06-16T07:15:00Z (14 min ago)
# Gate Timeout:   2026-06-17T07:15:00Z
```

### 4.3 Resolving a HITL Gate — Approval

Follow this procedure for every HITL gate approval. Do not skip steps under time pressure — the checklist exists precisely because of time pressure.

1. Run `cic-mesh hitl inspect --gate-id <id>` and read the full output.
2. Verify the pending action matches the originating workflow intent.
3. Review the risk summary generated by SafetyGateAgent.
4. If the action involves PII or external data transmission, verify recipient identity and domain.
5. If the action involves file writes or destructive operations, verify the scope and reversibility.
6. If the action involves communication to external parties, confirm the content is appropriate.
7. If all checks pass, approve with documented rationale.
8. Confirm the workflow resumes within 30 seconds after approval.

```bash
# Approve a gate with required rationale
cic-mesh hitl approve --gate-id gate-x1y2z3 \
  --rationale "Verified: recipient domain confirmed, content reviewed, no PII detected"
```

| Pre-Approval Question | If YES | If NO |
|---|---|---|
| Does the action match the workflow's stated intent? | Proceed to next check | Reject — possible intent drift or injection |
| Have all recipients/targets been verified? | Proceed | Modify gate before approving |
| Is the action reversible if incorrect? | Proceed with lower urgency | Escalate to L2 before approving |
| Does the risk summary indicate LOW or MEDIUM risk? | Proceed | Escalate to L2 or AI Safety Officer |
| Is the data scope within expected parameters? | Proceed | Reject and investigate |

### 4.4 Resolving a HITL Gate — Rejection

```bash
# Reject with reason and action directive
cic-mesh hitl reject --gate-id gate-x1y2z3 \
  --reason "Recipient email unverified — address not in approved contact list" \
  --action "modify-and-resubmit"
  # OR --action "cancel-workflow" for cases where the workflow itself is invalid
```

After rejection with `modify-and-resubmit`, the workflow enters `AWAITING_OPERATOR_INPUT` state and the action is returned to the operator for correction. After rejection with `cancel-workflow`, the workflow is cancelled and a cancellation record is written to the audit log.

### 4.5 Modifying a Pending Action Before Approval

```bash
# Correct a field in the pending action before approving
cic-mesh hitl modify --gate-id gate-x1y2z3 \
  --field "to_recipients" \
  --value "correct-address@company.com" \
  --note "Corrected recipient: original auto-populated from stale contact record"

# Then approve with rationale documenting the modification
cic-mesh hitl approve --gate-id gate-x1y2z3 \
  --rationale "Modified to_recipients from incorrect auto-fill to verified address; approved"
```

> **⚠ WARNING** — Only modify fields explicitly listed as modifiable in the gate output. Attempting to modify fields outside the allowed set will return an error. Modifiable fields are defined by the workflow's HITL configuration and cannot be overridden by operators.

### 4.6 Escalating a HITL Gate

Escalate a gate when: it involves regulatory, legal, or compliance risk; the action scope is larger than expected; or you are uncertain about any aspect of the approval. Escalation is never a sign of operator failure — it is the correct procedure.

```bash
# Escalate gate to L2 operator
cic-mesh hitl escalate --gate-id gate-x1y2z3 --to L2 \
  --reason "Action scope includes external regulatory filing — beyond L1 authority"

# Escalate to AI Safety Officer (for safety policy concerns)
cic-mesh hitl escalate --gate-id gate-x1y2z3 --to SAFETY_OFFICER \
  --reason "SafetyGateAgent risk score unusually high for this action type"
```

### 4.7 HITL Timeout Handling

Default gate timeout is 24 hours for Confirmational and Informational gates, and 4 hours for Blocking gates. At timeout, the workflow automatically transitions to `SUSPENDED` state and an alert fires to the on-call operator queue.

```bash
# Extend a gate's timeout before it expires
cic-mesh hitl extend --gate-id gate-x1y2z3 \
  --extension 4h \
  --reason "Awaiting L2 review for escalated gate"

# After timeout fires: recover suspended workflow
cic-mesh hitl recover --gate-id gate-x1y2z3
# Then approve or reject as normal
```

### 4.8 HITL Audit and Reporting

```bash
# Export HITL audit log for a date range
cic-mesh hitl audit-log --from 2026-06-01 --to 2026-06-30 \
  --format csv --output /reports/hitl-june-2026.csv

# Generate monthly HITL summary report
cic-mesh hitl report --month 2026-06 --output /reports/hitl-report-june-2026.pdf
```

**Required fields in audit export:** Gate ID, Workflow ID, Gate Tier, Action Type, Resolution (APPROVED/REJECTED/MODIFIED/ESCALATED), Resolved By (operator ID), Resolution Timestamp, Rationale, Time to Resolution (minutes).

### Chapter 4 Summary

- HITL gates are mandatory human checkpoints — they cannot be bypassed by any runtime profile or configuration.
- Three gate tiers: Informational (acknowledge), Confirmational (approve/reject/modify), Blocking (L2+ required).
- Always run the pre-approval checklist before approving any gate — verify intent match, recipient identity, and data scope.
- Escalation is the correct response when uncertain; never approve a gate that raises unresolved concerns.

---

## Chapter 5: Log Interpretation

### 5.1 Log Infrastructure Overview

CIC Mesh logs are structured JSON, aggregated in real time to the centralized log management platform (default deployment: Elasticsearch + Kibana, with optional CloudWatch or Datadog integration). All agents, orchestrators, connectors, and infrastructure components write to this system. Logs are retained for 90 days hot and 2 years cold archive.

| Access Method | How | Best For |
|---|---|---|
| CLI | `cic-mesh logs query [flags]` | Quick queries, incident response |
| Dashboard UI | ops.cic-mesh.internal/prod → Logs | Visual exploration, log correlation |
| Log API | `GET /api/v1/logs?workflow_id=...&since=...&level=...` | Automated reporting, integrations |
| Kibana / Grafana | logs.cic-mesh.internal | Advanced queries, dashboards, alerts |

### 5.2 Log Schema Reference

```json
{
  "timestamp":       "2026-06-16T08:42:13.447Z",   // ISO 8601 UTC
  "level":           "INFO",                         // DEBUG|INFO|WARN|ERROR|CRITICAL
  "workflow_id":     "wf-a1b2c3d4",                 // Parent workflow identifier
  "agent_id":        "ResearchAgent-07",             // Emitting agent
  "event_type":      "AGENT_INVOCATION_START",       // See event type table below
  "duration_ms":     null,                           // Populated on completion events
  "token_count":     null,                           // Populated on LLM call completion
  "confidence":      null,                           // Agent output confidence score [0-1]
  "retrieval_score": null,                           // Retrieval result relevance [0-1]
  "tool_name":       null,                           // Name of tool called, if applicable
  "error_code":      null,                           // ERR-XXX if error event
  "error_message":   null,                           // Human-readable error detail
  "span_id":         "span-e5f6g7h8",               // Current trace span
  "parent_span_id":  "span-a1b2c3d4",               // Parent span for hierarchy
  "trace_id":        "trace-z9y8x7w6",              // Root trace for full workflow
  "metadata":        {}                              // Arbitrary key/value context
}
```

| event_type | Meaning |
|---|---|
| WORKFLOW_START | Workflow accepted and queued |
| TASK_GRAPH_CREATED | Planning complete; execution graph built |
| AGENT_INVOCATION_START | An agent has been called to execute a task |
| AGENT_INVOCATION_COMPLETE | Agent completed its task (check confidence) |
| TOOL_CALL | Agent invoked an external tool (web search, file read, etc.) |
| RETRIEVAL_QUERY | Vector store retrieval initiated |
| RETRIEVAL_RESULT | Retrieval completed (check retrieval_score) |
| HITL_GATE_OPENED | SafetyGateAgent created a HITL checkpoint |
| HITL_GATE_RESOLVED | Operator resolved the HITL gate |
| WORKFLOW_COMPLETE | Workflow finished successfully |
| WORKFLOW_FAILED | Workflow terminated with error (check error_code) |
| CIRCUIT_BREAKER_OPEN | Circuit breaker tripped; downstream calls blocked |
| CIRCUIT_BREAKER_CLOSE | Circuit breaker recovered; calls resuming |
| SAFETY_POLICY_BLOCK | Action blocked by SafetyGateAgent policy (no HITL gate created) |

### 5.3 Reading a Workflow Execution Log

To trace a complete workflow execution, follow these steps:

1. Query all logs for the target `workflow_id`: `cic-mesh logs query --workflow-id wf-a1b2c3d4 --since 24h`
2. Order results by timestamp ascending.
3. Find the `WORKFLOW_START` event to establish baseline.
4. Find `TASK_GRAPH_CREATED` — this marks end of planning phase and shows number of tasks.
5. Trace each `AGENT_INVOCATION_START` / `AGENT_INVOCATION_COMPLETE` pair — note `duration_ms` and `confidence`.
6. Inspect any `RETRIEVAL_QUERY` / `RETRIEVAL_RESULT` pairs — check `retrieval_score` (healthy > 0.70).
7. Check for `HITL_GATE_OPENED` events and their corresponding `HITL_GATE_RESOLVED`.
8. Find `WORKFLOW_COMPLETE` or `WORKFLOW_FAILED` as the terminal event.

**Sample Annotated Log Trace:**

```
08:42:10.001Z  INFO   WORKFLOW_START            wf-a1b2c3d4  MasterOrchestrator
  → Workflow accepted and queued. Trace: trace-z9y8x7w6

08:42:10.843Z  INFO   TASK_GRAPH_CREATED        wf-a1b2c3d4  TaskGraphBuilder
  → Planning complete. 4 tasks created. metadata: {task_count: 4}

08:42:11.100Z  INFO   AGENT_INVOCATION_START    wf-a1b2c3d4  ResearchAgent-07
  → Research task beginning. span-e5f6g7h8

08:42:11.300Z  INFO   RETRIEVAL_QUERY           wf-a1b2c3d4  ResearchAgent-07
  → Querying KnowledgeBase-Technical. query: "EU AI regulation 2026"

08:42:11.580Z  INFO   RETRIEVAL_RESULT          wf-a1b2c3d4  ResearchAgent-07
  → retrieval_score: 0.82  ← HEALTHY (above 0.70 threshold)
    duration_ms: 280

08:42:18.220Z  INFO   AGENT_INVOCATION_COMPLETE wf-a1b2c3d4  ResearchAgent-07
  → confidence: 0.88  duration_ms: 7120  token_count: 3214
    ← HEALTHY (above 0.72 threshold)

08:42:18.500Z  INFO   AGENT_INVOCATION_START    wf-a1b2c3d4  WritingAgent-02
  → Drafting report from research output. span-b9c8d7e6

08:42:31.100Z  INFO   AGENT_INVOCATION_COMPLETE wf-a1b2c3d4  WritingAgent-02
  → confidence: 0.91  duration_ms: 12600  token_count: 4100

08:42:31.200Z  INFO   HITL_GATE_OPENED          wf-a1b2c3d4  SafetyGateAgent
  → gate-x1y2z3  Tier: CONFIRMATIONAL  Action: SEND_EMAIL
    ← Workflow now AWAITING_HITL. Operator action required.

08:44:05.999Z  INFO   HITL_GATE_RESOLVED        wf-a1b2c3d4  SafetyGateAgent
  → gate-x1y2z3  Resolution: APPROVED  resolved_by: ops-user-09
    time_to_resolve_min: 1.8

08:44:06.500Z  INFO   WORKFLOW_COMPLETE         wf-a1b2c3d4  MasterOrchestrator
  → Total duration: 1m56s  tasks_completed: 4/4
```

### 5.4 Error Code Reference

| Code | Name | Meaning | Common Cause | Recommended Action |
|---|---|---|---|---|
| ERR-001 | API_TIMEOUT | External API call exceeded timeout | Network latency; external service slow | Retry; if persistent, check connector health |
| ERR-002 | TOKEN_BUDGET_EXCEEDED | Workflow consumed max token allocation | Overly broad intent; THOROUGH profile on large input | Refine intent or switch to scoped profile |
| ERR-003 | CONFIDENCE_BELOW_THRESHOLD | Agent output confidence too low to proceed | Ambiguous input; retrieval quality poor | Review retrieval config; check index freshness |
| ERR-004 | RETRIEVAL_FAILURE | Vector store query returned no results | Index unavailable or query malformed | Run `cic-mesh retrieval health`; see §6.6 |
| ERR-005 | HITL_TIMEOUT | HITL gate expired without operator resolution | Operator missed alert; understaffing | Recover gate (`hitl recover`); review staffing |
| ERR-006 | CIRCUIT_BREAKER_OPEN | Circuit breaker tripped; downstream calls blocked | Repeated downstream failures | Identify failing downstream; await auto-recovery or reset |
| ERR-007 | AGENT_CRASH | Agent pod terminated unexpectedly | OOM; unhandled exception; infra failure | Inspect agent logs; restart pod; see §6.4 |
| ERR-008 | INVALID_TASK_GRAPH | Task graph built by TaskGraphBuilder is invalid | Malformed intent; planner bug | Rephrase intent; check TaskGraphBuilder logs |
| ERR-009 | SAFETY_GATE_BLOCK | Action blocked by SafetyGateAgent policy | Policy violation; prohibited action type | Review action against safety policy; escalate to AI Safety Officer |
| ERR-010 | TOOL_AUTH_FAILURE | Tool call rejected due to authentication error | Expired API key; revoked credential | Rotate credentials; see §10.4 |
| ERR-011 | EVENT_BUS_DISCONNECT | Agent lost connection to event bus | Network partition; event bus overload | Check event bus health; see §6.8 |
| ERR-012 | MODEL_API_RATE_LIMIT | Model API returned HTTP 429 | High workflow volume; quota exceeded | Switch to secondary endpoint; see §6.9 |
| ERR-013 | RETRIEVAL_INDEX_UNAVAILABLE | Vector index not responding | Index rebuilding; storage failure | Check retrieval health; trigger re-index if needed |
| ERR-014 | PII_DETECTION_BLOCK | PII detected in output destined for external transmission | User input contained personal data; prompt injection | Review output; redact PII; escalate if suspicious |
| ERR-015 | REVIEWER_REJECTION | ReviewerAgent rejected agent output as low quality | Hallucinated content; poor retrieval; ambiguous task | Review output; check confidence score; refine input |
| ERR-016 | WORKFLOW_STATE_CORRUPTION | Workflow state store entry is unreadable or inconsistent | Storage failure; mid-write crash | Attempt rollback to checkpoint; escalate to L3 |
| ERR-017 | SCHEDULER_MISSED_EXECUTION | Scheduled workflow did not fire at its appointed time | SchedulerAgent crash; clock skew | Check scheduler logs; manually trigger; investigate agent health |
| ERR-018 | CONNECTOR_OFFLINE | External connector (email, calendar, etc.) is unreachable | Auth expiry; external service outage | Check connector status; re-authenticate; see §6.10 |
| ERR-019 | FALLBACK_CHAIN_EXHAUSTED | All agents in fallback chain failed or were unavailable | Cascading failures; model API outage | Switch to SAFE profile; escalate to L3; see §6.11 |
| ERR-020 | UNKNOWN_AGENT_ROLE | Workflow references an agent role not registered in the mesh | Workflow config references a removed or renamed agent | Review workflow definition; update agent role reference |

### 5.5 Log Patterns — Normal Operations

| Pattern Type | HEALTHY Sequence | DEGRADED Sequence (Warning Sign) |
|---|---|---|
| Research Workflow | WORKFLOW_START → TASK_GRAPH_CREATED → AGENT_INVOCATION_START → RETRIEVAL_QUERY → RETRIEVAL_RESULT (score >0.70) → AGENT_INVOCATION_COMPLETE (confidence >0.72) → WORKFLOW_COMPLETE | RETRIEVAL_RESULT with score <0.50, followed by AGENT_INVOCATION_COMPLETE with confidence <0.65 → ERR-003 |
| Email Workflow | ...AGENT_INVOCATION_COMPLETE → HITL_GATE_OPENED (CONFIRMATIONAL) → HITL_GATE_RESOLVED (APPROVED, <5 min) → TOOL_CALL (send_email) → WORKFLOW_COMPLETE | HITL gate open for >60 min; gate timeout imminent; ERR-005 fires |
| Scheduled Workflow | WORKFLOW_START (triggered_by: scheduler) → normal execution → WORKFLOW_COMPLETE within expected window | No WORKFLOW_START event at scheduled time → ERR-017; check SchedulerAgent heartbeat |

### 5.6 Log Patterns — Alert Conditions

```bash
# Find all CRITICAL logs in the last 1 hour
cic-mesh logs query --level CRITICAL --since 1h

# Find all events for a specific workflow
cic-mesh logs query --workflow-id wf-a1b2c3d4 --since 24h

# Find all circuit breaker events in last 24h
cic-mesh logs query --event-type CIRCUIT_BREAKER_OPEN --since 24h

# Find all HITL gate timeouts
cic-mesh logs query --event-type WORKFLOW_FAILED --error-code ERR-005 --since 7d

# Find all PII blocks in the last 30 days (compliance check)
cic-mesh logs query --event-type SAFETY_POLICY_BLOCK --error-code ERR-014 --since 30d

# Find all confidence failures
cic-mesh logs query --event-type AGENT_INVOCATION_COMPLETE \
  --filter "confidence<0.65" --since 24h
```

### Chapter 5 Summary

- All logs are structured JSON; use `trace_id`, `workflow_id`, and `span_id` to correlate events across agents.
- Healthy `retrieval_score` is above 0.70; healthy agent confidence is above 0.72. Values below these indicate quality degradation.
- 20 defined error codes covering all major failure classes — ERR-012 (rate limit) and ERR-006 (circuit breaker) are the most operationally common.
- Use `cic-mesh logs query` with `--event-type` and `--error-code` flags for rapid alert triage.

---

## Chapter 6: Troubleshooting Guide

### 6.1 Troubleshooting Methodology (DORI)

Apply the DORI framework to every mesh issue regardless of severity:

1. **Detect:** What is the symptom? What alert fired? What is the user/operator reporting? What changed recently?
2. **Observe:** Pull logs, check dashboards, inspect workflow status and HITL queue. Establish the failure timeline.
3. **Reason:** Correlate observations to identify probable root cause. Check error codes, confidence scores, circuit breaker states, and agent heartbeats.
4. **Intervene:** Execute the appropriate runbook. Document every action taken. Verify the intervention resolved the issue. If not, escalate.
5. **Validate:** Confirm normal operating state (Section 2.3 thresholds restored). Monitor for recurrence for a minimum of 30 minutes post-resolution.

### 6.2 Troubleshooting Decision Tree

```
Workflow not completing?
│
├─ cic-mesh workflow status --id <id>
│
├─ Status: AWAITING_HITL
│  └─ See Chapter 4: HITL Procedures. Check gate tier and resolve.
│
├─ Status: FAILED
│  ├─ Check error_code in logs
│  ├─ ERR-001/ERR-012 → Model/API issue → See §6.9
│  ├─ ERR-003/ERR-004 → Retrieval issue → See §6.6
│  ├─ ERR-005         → HITL timeout    → See §4.7
│  ├─ ERR-006         → Circuit breaker → See §6.8
│  ├─ ERR-007         → Agent crash     → See §6.4
│  ├─ ERR-010/ERR-018 → Auth/Connector  → See §6.10
│  └─ ERR-016/ERR-019 → Escalate to L3  → See §6.11
│
├─ Status: EXECUTING (stuck >30 min with no new log events)
│  ├─ Check agent heartbeats: cic-mesh agent list --heartbeat-stale
│  ├─ Agent unresponsive → See §6.4
│  └─ Event bus lag     → See §6.8
│
└─ Status: PLANNING (stuck >5 min)
   ├─ Check TaskGraphBuilder and IntentPlanner logs
   └─ Orchestrator loop → See §6.5
```

### 6.3 Common Issue: Workflow Fails with Error Code

#### Model API / External Tool Errors (ERR-001, ERR-010, ERR-012)

**Symptom:** Workflow fails with `AGENT_INVOCATION_COMPLETE` followed by `WORKFLOW_FAILED`; error code ERR-001 or ERR-012 in logs.

```bash
# Diagnose
cic-mesh logs query --workflow-id <id> --event-type WORKFLOW_FAILED
cic-mesh connector status --id model-api-primary
```

**Resolution:** For ERR-012 (rate limit), switch to secondary model endpoint (see §6.9). For ERR-001 (timeout), check network connectivity and retry. For ERR-010 (auth), rotate the relevant credential (see §10.4).

#### Retrieval Errors (ERR-003, ERR-004, ERR-013)

**Symptom:** Agents completing with low confidence; `retrieval_score` consistently below 0.50; ERR-004 in logs.

```bash
# Diagnose
cic-mesh retrieval health
cic-mesh retrieval index status --config KnowledgeBase-Technical
```

**Resolution:** If index is unavailable, trigger re-index. If confidence is low despite available index, check index freshness and escalate to L3 for embedding model review. See §6.6.

### 6.4 Common Issue: Agent Unresponsive / Stuck

**Detection:** No log events from the agent for >5 minutes; heartbeat alert fires; event bus queue growing on that agent's topic.

```bash
# Check agent health
cic-mesh agent status --id ResearchAgent-07

# Tail the agent's last 50 log lines
cic-mesh agent logs --id ResearchAgent-07 --tail 50

# Soft restart (graceful — allows in-flight work to complete)
cic-mesh agent restart --id ResearchAgent-07 --soft

# Hard restart (immediate — requires L2 authorization)
cic-mesh agent restart --id ResearchAgent-07 --hard --ticket OPS-5678
```

> **⚠ WARNING** — A hard restart may cause loss of the current agent task's progress. The workflow will attempt to retry from the last checkpoint, but any in-flight LLM generation is lost. Always try soft restart first and wait 60 seconds for resolution before escalating to hard restart.

### 6.5 Common Issue: Orchestrator Planning Loop Stuck

**Symptom:** Workflow in PLANNING state for >5 minutes. Repeated `TASK_GRAPH_CREATED` events in logs (loop indicator). No `AGENT_INVOCATION_START` events following planning.

```bash
# Check orchestrator logs
cic-mesh logs query --agent-id TaskGraphBuilder --since 1h
cic-mesh logs query --agent-id IntentPlanner --since 1h

# Check for repeated TASK_GRAPH_CREATED events (loop signature)
cic-mesh logs query --workflow-id <id> --event-type TASK_GRAPH_CREATED
```

**Resolution:** Cancel the stuck workflow and re-trigger with a more specific intent. If the loop persists across multiple workflows, restart IntentPlanner and TaskGraphBuilder. If loop continues after restart, escalate to L3 — this may indicate a planner prompt regression requiring a prompt rollback (see §9.5).

### 6.6 Common Issue: Retrieval Quality Degraded

**Symptom:** Workflows completing but output quality declining; agent confidence scores trending down; `retrieval_score` below 0.60 on recent workflows.

```bash
# Run retrieval diagnostic
cic-mesh retrieval diagnose --config KnowledgeBase-Technical

# Check index freshness (last updated timestamp)
cic-mesh retrieval index status --config KnowledgeBase-Technical

# Check embedding model version
cic-mesh retrieval embedding-model status

# Trigger incremental re-index
cic-mesh retrieval reindex --config KnowledgeBase-Technical --mode incremental
```

If retrieval quality does not improve after re-index, escalate to L3 for embedding model review. An embedding model version change may require a full index rebuild, which is a planned maintenance operation.

### 6.7 Common Issue: HITL Gate Backlog Growing

**Symptom:** More than 10 HITL gates pending; average resolution time >30 minutes; alert "HITL_BACKLOG" firing.

```bash
# View all pending gates ordered by age (oldest first)
cic-mesh hitl list --status PENDING --sort age-desc

# Bulk triage: list gates by tier and age
cic-mesh hitl list --status PENDING --tier BLOCKING --sort age-desc
```

**Causes and Resolution:**

- **Insufficient operator coverage:** Escalate on-call; bring in additional L1 operators for triage shift.
- **Workflow volume spike:** Apply workflow rate limiting; prioritize BLOCKING gates first.
- **Misconfigured HITL tier definition:** Escalate to AI Safety Officer to review threshold configuration — do not adjust thresholds without Safety Officer approval.

### 6.8 Common Issue: Event Bus Lag

**Detection:** Event bus queue depth alert firing; workflow execution times increasing across all workflows; agents responding normally individually but inter-agent handoff delayed.

```bash
# Check queue depth
cic-mesh mesh event-bus queue-depth

# Check consumer lag per topic
cic-mesh mesh event-bus consumer-lag --all

# Short-term: apply workflow rate limiting to reduce inflow
cic-mesh mesh rate-limit --workflows-per-minute 20

# Long-term: consumer scaling (Platform Engineering action)
# Submit a Platform Engineering ticket for event bus consumer scaling.
```

### 6.9 Common Issue: Model API Rate Limiting (ERR-012)

**Symptoms:** Multiple workflows failing with ERR-012; HTTP 429 responses appearing in model connector logs; agent invocations timing out.

```bash
# Check model API connector status
cic-mesh connector status --id model-api-primary

# Switch active workflows to secondary model endpoint
cic-mesh config set --key model_api_endpoint \
  --value secondary \
  --approve-with OPS-6789

# Verify switch took effect
cic-mesh connector status --id model-api-secondary
```

Notify Platform Engineering to investigate quota increase with the model provider. Revert to primary endpoint once rate limit window has passed and confirmed clear.

### 6.10 Common Issue: Connector Authentication Failure

**Detection:** ERR-010 or ERR-018 in logs; connector health shows DEGRADED; HITL gates for email/calendar actions failing to dispatch.

```bash
# Check all connector statuses
cic-mesh connector status --all

# Re-authenticate a specific connector
cic-mesh connector reauth --id email-connector \
  --credential-source vault://connectors/email-prod \
  --ticket OPS-7890
```

In-flight workflows waiting on a connector are suspended automatically during re-authentication and resume once the connector reports HEALTHY. Workflows that have already failed must be restarted from their last checkpoint.

### 6.11 Escalation Runbook

When all standard troubleshooting steps have been exhausted, escalate to L3 with the following information fully assembled:

1. All affected workflow IDs
2. Error codes observed and corresponding log timestamps
3. Full log exports covering the incident window (`cic-mesh logs export --since 2h`)
4. Agent statuses at time of failure
5. Complete timeline: when first observed, what changed prior, actions taken
6. Business impact assessment: how many users/workflows affected, any external actions taken
7. Actions already attempted and their outcomes

### Chapter 6 Summary

- Apply DORI (Detect → Observe → Reason → Intervene) to every issue before taking action.
- The decision tree routes all common failure symptoms to their specific runbook section.
- Always try soft restart before hard restart; always document every action with a ticket reference.
- When all runbook steps fail, escalate to L3 with the full escalation package assembled before reaching out.

---

## Chapter 7: Adding New Agents and Workflows

### 7.1 When to Add a New Agent

Add a new agent when a required capability does not exist in any current agent and cannot be satisfied by extending an existing agent's tool manifest. New agents must follow the single-responsibility principle: one agent, one well-defined capability domain. If an existing agent could handle the capability with a new tool added to its manifest, prefer that path and submit a tool manifest change request instead.

### 7.2 Agent Onboarding Process

1. **Design Review:** Submit agent design document to Mesh Architect. AI Safety Officer sign-off required for any agent with HITL interactions or external transmission capabilities.
2. **Write Agent Config JSON** per schema in §7.3.
3. **Define Retrieval Config** for the agent (which knowledge base it queries).
4. **Define Tool Manifest** listing all tools the agent is permitted to call.
5. **Set Confidence Threshold and Escalation Policy** per domain risk level.
6. **Write Agent System Prompt** and register in the prompt registry.
7. **Deploy to SANDBOX** environment.
8. **Run Integration Test Suite** (minimum: config validation, event-bus integration, end-to-end workflow trace).
9. **Review SANDBOX logs for 48 hours.** Confidence scores, retrieval quality, and tool usage must be within expected ranges.
10. **Deploy to STAGING** with shadow traffic (10% of representative workflow volume).
11. **Review STAGING reliability metrics for 1 week.** Success rate must be >97%.
12. **Deploy to PROD** via change control ticket. Requires L3 Architect approval.
13. **Monitor PROD for 72 hours** post-deployment. Assign dedicated reviewer for first 24h.
14. **Document agent** in the Agent Catalog (location: internal wiki /agents/).

### 7.3 Agent Configuration File Reference

```json
{
  "agent_id":            "NewAgent-01",
  "role":                "Legal Document Analyst",
  "layer":               "executor",
  "system_prompt_ref":   "prompts/new-agent-v1",
  "retrieval_config":    "KnowledgeBase-Legal",
  "tools": [
    "search_web",
    "read_file",
    "extract_entities"
  ],
  "token_budget":        4096,
  "confidence_threshold": 0.72,
  "escalation_policy": {
    "on_low_confidence": "escalate_to_reviewer",
    "on_tool_failure":   "retry_3_then_fallback",
    "on_timeout_ms":     30000
  },
  "fallback_chain": [
    "GeneralistAnalystAgent",
    "HUMAN_ESCALATE"
  ],
  "runtime_profiles": ["BALANCED", "THOROUGH", "SAFE"],
  "hitl_required":       false,
  "tags": ["executor", "legal", "document-analysis"]
}
```

### 7.4 Defining a New Workflow

```yaml
workflow:
  name: "LegalDocumentReview"
  description: "Reviews uploaded legal documents for key clauses and risks"
  version: "1.0"
  trigger:
    type: user_intent
    patterns:
      - "review this contract"
      - "analyze legal document"
      - "check this agreement"
  profile: THOROUGH
  agents:
    - role: planner
      agent: IntentPlanner
    - role: executor
      agent: DocumentAnalystAgent
    - role: reviewer
      agent: ReviewerAgent
    - role: safety
      agent: SafetyGateAgent
  hitl:
    tier: CONFIRMATIONAL
    triggers:
      - action_type: file_access
      - confidence_below: 0.75
  output:
    format: structured_report
    delivery: in_session
  archival:
    enabled: true
    retention_days: 90
```

### 7.5 Testing New Agents and Workflows

```bash
# Run full agent test suite in SANDBOX
cic-mesh test agent --id NewAgent-01 --env sandbox --suite full

# Run workflow end-to-end test
cic-mesh test workflow --name LegalDocumentReview --env sandbox \
  --intent "Review the attached NDA for key clauses"

# Minimum pass criteria before STAGING promotion:
# - Config validation: 100% pass
# - Event bus integration: <200ms round-trip
# - End-to-end workflow: success rate >95% over 20 test runs
# - Confidence score average: >0.72
# - No CRITICAL log events during test suite
```

### 7.6 Prompt Registry Management

Agent system prompts are stored in the prompt registry at `/registry/prompts/`, versioned with semantic versioning (e.g., v1.0, v1.1). Every prompt version is immutable once deployed — changes always create a new version.

```bash
# View current prompt version for an agent
cic-mesh prompt show --agent-id ResearchAgent-07

# Deploy a new prompt version to SANDBOX (shadow test)
cic-mesh prompt deploy --agent-id ResearchAgent-07 \
  --version v1.4 --env sandbox --shadow-ratio 0.10

# Promote to STAGING after shadow validation
cic-mesh prompt promote --agent-id ResearchAgent-07 --version v1.4 --to staging

# Rollback a prompt to a previous version
cic-mesh prompt rollback --agent-id ResearchAgent-07 --to-version v1.2 \
  --reason "v1.3 producing inconsistent confidence scores"
```

### Chapter 7 Summary

- New agents require Mesh Architect + AI Safety Officer design review before any deployment begins.
- The 14-step onboarding process gates on SANDBOX (48h), STAGING (1 week), and PROD (72h) observation periods.
- Agent config defines token budget, confidence threshold, fallback chain, and tool whitelist — all of which must be explicitly justified in the design review.
- Prompt changes follow shadow test → STAGING → PROD with immutable versioning and instant rollback capability.

---

## Chapter 8: Runtime Profile Management

### 8.1 Runtime Profile Overview

Runtime profiles control the operational behavior of the mesh: retrieval depth, token budgets, parallelism, HITL gate frequency, and timeout values. Each profile represents a pre-validated configuration optimized for a specific operational context.

| Profile | P95 Latency | Token Cost | Retrieval Depth | HITL Frequency | Best For |
|---|---|---|---|---|---|
| FAST | <30s | 0.5x | Shallow (top-3) | Reduced | Real-time queries; low-stakes tasks |
| BALANCED | <90s | 1.0x | Standard (top-10) | Standard | Default for most user-initiated workflows |
| THOROUGH | <5min | 2.5x | Deep (top-25 + web) | Standard | Research, legal review, complex analysis |
| SCHEDULED | <10min | 1.0x | Standard (top-10) | Reduced | Automated scheduled workflows |
| SAFE | <3min | 1.0x | Standard (top-10) | Maximum | Security incidents; post-incident recovery; new agent monitoring |

### 8.2 Viewing Current Profile Assignments

```bash
# List all profiles
cic-mesh profile list

# Show full config for a specific profile
cic-mesh profile show --name BALANCED

# List all active workflows using a specific profile
cic-mesh workflow list --profile FAST
```

### 8.3 Switching Runtime Profiles

```bash
# Switch a specific active workflow to a different profile
cic-mesh workflow update --id wf-a1b2c3d4 --profile THOROUGH

# Switch a scheduled workflow series to a new profile
cic-mesh schedule update --name DailyHealthDigest --profile SCHEDULED

# Change the global default profile (requires L2 approval + ticket)
cic-mesh config set --key default_profile \
  --value BALANCED \
  --approve-with OPS-2345
```

> **⚠ WARNING** — Profile switches on in-flight workflows take effect at the next agent invocation boundary — not immediately. A workflow already mid-invocation will complete that invocation on the old profile before switching. Do not assume an immediate behavioral change.

### 8.4 Creating a Custom Runtime Profile

Custom profiles are only appropriate when no standard profile meets operational needs. They require L3 Architect approval and must be tested in SANDBOX before any production use.

```yaml
# Custom profile YAML template
profile:
  name: "COMPLIANCE_REVIEW"
  based_on: THOROUGH
  overrides:
    retrieval_depth: 20
    token_budget_multiplier: 2.0
    hitl_gate_tier: BLOCKING
    parallel_agent_limit: 2
    timeout_ms: 120000
  approved_by: "mesh-architect-01"
  ticket: "CHG-0892"
  environments: ["SANDBOX", "STAGING"]
```

### 8.5 Profile Emergency Override

> **⚠ CRITICAL — P1-Level Action**
>
> Global profile override to SAFE is a P1-level action. It affects all active workflows immediately at their next agent boundary. It requires L2 authorization and must be logged with a ticket ID. Auto-reverts after the specified duration unless explicitly extended.

```bash
# Invoke global SAFE profile override
cic-mesh profile override --global SAFE \
  --reason "Security incident: model output anomaly detected in wf-x9y8z7" \
  --ticket OPS-5678 \
  --duration 2h

# Extend override if incident not yet resolved
cic-mesh profile override --extend --duration 1h --ticket OPS-5678

# Revert override manually (before auto-revert)
cic-mesh profile override --revert --ticket OPS-5678
```

### Chapter 8 Summary

- Five standard profiles: FAST (low latency), BALANCED (default), THOROUGH (deep analysis), SCHEDULED (automated), SAFE (maximum oversight).
- Profile switches on in-flight workflows take effect at the next agent invocation boundary, not immediately.
- Global SAFE override is a P1-level action requiring L2 authorization; always specify a duration and ticket ID.
- Custom profiles require L3 approval and SANDBOX validation before any production deployment.

---

## Chapter 9: Safety Procedures and Rollback

### 9.1 Safety Philosophy

The CIC Mesh safety model is defense in depth: no single component is the sole safeguard for any consequential action. The ReviewerAgent evaluates output quality before the SafetyGateAgent evaluates it for policy compliance. HITL gates ensure human oversight for actions above the risk threshold. Operators are the final human check before any external action executes.

Operators must internalize this principle: **when in doubt, do not approve.** Escalation is always the safer path. The system is designed to tolerate delays; it is not designed to tolerate unsafe approvals.

### 9.2 Safety Gate Policy Management

SafetyGateAgent policy changes are the exclusive domain of the AI Safety Officer. No other role may modify confidence thresholds, HITL tier definitions, or action-type classifications without explicit Safety Officer approval and a change control ticket. All safety config changes are logged in the immutable audit log with before/after values.

### 9.3 Triggering a Safety Incident Response

Declare a safety incident immediately when any of the following occur: model producing harmful or policy-violating output; workflow executing unintended consequential actions; HITL gate bypassed (this should never happen — investigate and escalate immediately); PII exposed in output destined for external transmission.

```bash
cic-mesh workflow pause-all --tag <incident-tag>
cic-mesh profile override --global SAFE --reason "Safety incident" --ticket OPS-<id> --duration 4h
cic-mesh logs export --since 2h --format json > incident-$(date +%Y%m%d-%H%M%S).json
```

### 9.4 Workflow Rollback Procedures

#### Soft Rollback

```bash
# Re-run workflow from last preserved checkpoint
cic-mesh workflow rollback --id wf-a1b2c3d4 --to-checkpoint <checkpoint-id>

# List available checkpoints for a workflow
cic-mesh workflow checkpoints --id wf-a1b2c3d4
```

#### Hard Rollback

```bash
# Cancel workflow and flag for manual side-effect reversal
cic-mesh workflow rollback --id wf-a1b2c3d4 --hard \
  --reason "Email dispatched to incorrect recipient" \
  --incident-id OPS-9999
```

**Side Effect Reversal Checklist:**

| Side Effect Type | Reversibility | Reversal Action |
|---|---|---|
| Email sent | Not reversible | Notify recipient with correction; log recipient notification |
| Files modified | Reversible | Restore from backup snapshot taken before workflow |
| Calendar events created | Reversible | Delete via connector; confirm deletion in calendar service |
| External API calls made | Partially reversible | Contact API provider; document all calls made |
| CRM records updated | Reversible | Restore from CRM audit log / previous record version |

### 9.5 Agent Rollback (Model or Prompt Version)

```bash
# Roll back agent to previous prompt version
cic-mesh agent update --id ResearchAgent-07 \
  --prompt-version v1.2 \
  --reason "Rollback: v1.3 producing low confidence outputs in >15% of invocations" \
  --ticket CHG-1102

# Roll back agent to previous full config version
cic-mesh agent rollback --id ResearchAgent-07 --to-config-version v2.0
```

### 9.6 Retrieval Config Rollback

```bash
# Roll back retrieval config to a previous validated version
cic-mesh retrieval rollback --config KnowledgeBase-Technical --to-version v2.1 \
  --reason "v2.2 index producing low retrieval scores after re-index" \
  --ticket CHG-1103
```

### 9.7 Full Mesh Emergency Shutdown

> **⚠ CRITICAL — Last Resort Only**
>
> Full mesh shutdown is irreversible in the short term. All in-flight workflows will be suspended. No new workflows can execute until the mesh is restored. This action requires L3 Architect authorization and must be logged with a full incident ticket.

```bash
# Step 1: Initiate graceful drain (allows in-flight agents to complete current step)
cic-mesh mesh drain --timeout 300s

# Step 2: If drain hangs beyond timeout, force shutdown
cic-mesh mesh shutdown --force \
  --reason "P1 Security incident: uncontrolled model behavior" \
  --ticket OPS-9999

# Step 3: Verify all agent pods terminated
cic-mesh mesh status

# Recovery procedure:
# 1. Confirm root cause resolved (AI Safety Officer sign-off required)
# 2. Restore from last known-good state snapshots
# 3. Start in SAFE profile mode
# 4. Validate all connectors and retrieval indexes healthy
# 5. Resume workflows one at a time under close monitoring
cic-mesh mesh start --profile SAFE --ticket OPS-9999-RECOVERY
```

### 9.8 Post-Incident Review Process

1. **24h Immediate Review:** What happened, what was the impact, what immediate mitigations were applied. Attended by L2+, AI Safety Officer, and affected team leads.
2. **72h Deep Dive:** Full root cause analysis. All contributing factors identified. Corrective actions drafted.
3. **1-Week Corrective Action Plan:** All corrective actions assigned with owners and deadlines. Prevention measures documented. Monitoring improvements identified.

### Chapter 9 Summary

- Defense in depth: Reviewer → SafetyGate → HITL → Operator. No single point of failure for safety decisions.
- Safety incident response: pause workflows → activate SAFE profile → notify Safety Officer and L3 → preserve logs → investigate before resuming.
- Hard rollback does not reverse side effects — use the side-effect reversal checklist for every hard rollback.
- Full mesh shutdown requires L3 authorization and a root cause resolution sign-off from the AI Safety Officer before recovery begins.

---

## Chapter 10: Maintenance Operations

### 10.1 Routine Maintenance Tasks

| Frequency | Task | Procedure | Owner | Est. Time |
|---|---|---|---|---|
| Daily | HITL gate review | `cic-mesh hitl list --status PENDING` — resolve all gates <4h old | L1 | 15 min |
| Daily | Log error scan | `cic-mesh logs query --level ERROR --since 24h` — review all errors | L1 | 10 min |
| Daily | Circuit breaker status | `cic-mesh mesh circuit-breakers` — confirm all CLOSED | L1 | 5 min |
| Daily | Queue depth check | `cic-mesh mesh event-bus queue-depth` — confirm <100 | L1 | 5 min |
| Daily | Workflow success rate | Dashboard → Workflow SLO — confirm >97% | L1 | 5 min |
| Weekly | Retrieval index freshness | `cic-mesh retrieval index status --all` — verify last-updated timestamps | L2 | 20 min |
| Weekly | Confidence score trend review | Dashboard → Agent Confidence Trend — flag any declining agents | L2 | 15 min |
| Weekly | On-call handoff | Complete handoff log; confirm pager transfer | L1/L2 | 30 min |
| Weekly | Scheduler missed-run audit | `cic-mesh logs query --error-code ERR-017 --since 7d` | L1 | 10 min |
| Monthly | SLO review | Generate SLO report; compare to targets; identify trends | L2 | 1 hour |
| Monthly | HITL audit report | `cic-mesh hitl report --month <YYYY-MM>` | L2 | 30 min |
| Monthly | Access control audit | Review all operator accounts; confirm no excess permissions; disable stale accounts | L3 | 1 hour |
| Monthly | Prompt version audit | Review all agents' active prompt versions; verify no unapproved changes | L3 | 30 min |

### 10.2 Retrieval Index Management

```bash
# Full re-index (use during low-traffic window; takes 20-60 min depending on corpus size)
cic-mesh retrieval reindex --config KnowledgeBase-Technical --mode full \
  --ticket CHG-1201

# Incremental update (adds only new/changed documents; faster)
cic-mesh retrieval reindex --config KnowledgeBase-Technical --mode incremental

# Check index health
cic-mesh retrieval health

# Add a new document source to an existing index
cic-mesh retrieval source add \
  --config KnowledgeBase-Technical \
  --source-type sharepoint \
  --url "https://company.sharepoint.com/sites/engineering/Docs" \
  --ticket CHG-1202
```

### 10.3 Agent Pool Scaling

```bash
# View current replica counts
cic-mesh agent pool status

# Scale a specific agent pool up (for planned high-load events)
cic-mesh agent pool scale --id ResearchAgent --replicas 5

# Scale down after event
cic-mesh agent pool scale --id ResearchAgent --replicas 2

# Configure auto-scaling bounds
cic-mesh agent pool autoscale --id ResearchAgent \
  --min-replicas 2 \
  --max-replicas 8 \
  --scale-on cpu:70%,queue-depth:50
```

### 10.4 Credential Rotation

All external connector credentials (email, calendar, file services, model API keys) must be rotated on the schedule defined in the Credential Rotation Policy (default: 90 days). Rotation is performed without workflow downtime using the rolling update procedure.

```bash
# Rotate a connector credential (rolling — no downtime)
cic-mesh connector rotate-credential \
  --id email-connector \
  --new-credential-ref vault://connectors/email-prod-v2 \
  --strategy rolling \
  --ticket CHG-1301

# Verify rotation completed successfully
cic-mesh connector status --id email-connector

# Rotate model API key
cic-mesh connector rotate-credential \
  --id model-api-primary \
  --new-credential-ref vault://model-api/primary-key-v4 \
  --strategy rolling \
  --ticket CHG-1302
```

> **⚠ WARNING** — Always validate the new credential in STAGING before rotating in PROD. An invalid new credential will cause connector failure and ERR-010/ERR-018 errors across all workflows using that connector.

### 10.5 Backup and Restore

| Asset | Backup Frequency | Retention | Restore Command |
|---|---|---|---|
| Workflow state store | Continuous (WAL) | 7 days rolling | `cic-mesh state restore --to <timestamp>` |
| Retrieval index snapshots | Daily at 02:00 UTC | 30 days | `cic-mesh retrieval restore --snapshot <id>` |
| Prompt registry | On every write (versioned) | Indefinite | `cic-mesh prompt rollback --agent-id <id> --to-version <v>` |
| Agent configs | On every write (versioned) | Indefinite | `cic-mesh agent rollback --id <id> --to-config-version <v>` |
| Runtime profile definitions | Daily at 03:00 UTC | 90 days | `cic-mesh profile restore --name <profile> --snapshot <id>` |
| HITL audit logs | Continuous (append-only) | 2 years | Read-only archive; contact Platform Engineering |

All restore operations must be performed during a maintenance window with prior L3 approval, except for prompt and agent config rollbacks which are operational procedures (see §9.5).

### Chapter 10 Summary

- Daily checks (5 tasks, ~40 min total) keep the mesh in healthy state between incidents.
- Credential rotation uses a rolling strategy to avoid downtime — always validate in STAGING first.
- Retrieval index incremental updates are preferred over full re-index for routine freshness; full re-index for post-incident recovery.
- All restore operations (except prompt/config rollback) require a maintenance window and L3 approval.

---

## Appendix A: Quick Reference Card

### Most Common CLI Commands

| Task | Command |
|---|---|
| List pending HITL gates | `cic-mesh hitl list --status PENDING` |
| Approve a HITL gate | `cic-mesh hitl approve --gate-id <id> --rationale "..."` |
| Check workflow status | `cic-mesh workflow status --id <id>` |
| List active workflows | `cic-mesh workflow list --status EXECUTING` |
| Restart an agent (soft) | `cic-mesh agent restart --id <id> --soft` |
| Check circuit breakers | `cic-mesh mesh circuit-breakers` |
| Query error logs (1h) | `cic-mesh logs query --level ERROR --since 1h` |
| Pause all workflows | `cic-mesh workflow pause-all --tag <tag>` |
| Global SAFE override | `cic-mesh profile override --global SAFE --reason "..." --ticket <id> --duration 2h` |
| Check event bus queue | `cic-mesh mesh event-bus queue-depth` |

### Alert Severity Definitions

| Severity | Color | SLA | Meaning |
|---|---|---|---|
| P1 — Critical | Red | Ack 5min / L2 15min | Production mesh down or safety incident |
| P2 — High | Orange | Ack 15min / L2 1h | Significant failure or degradation |
| P3 — Medium | Yellow | Ack 1h | Degraded performance; non-critical |
| P4 — Low | Blue | Next business day | Advisory; cosmetic; informational |

### Error Code Quick-Lookup (Top 10)

| Code | Name | First Action |
|---|---|---|
| ERR-001 | API_TIMEOUT | Retry; check connector health |
| ERR-003 | CONFIDENCE_BELOW_THRESHOLD | Check retrieval quality (§6.6) |
| ERR-004 | RETRIEVAL_FAILURE | `cic-mesh retrieval health` |
| ERR-005 | HITL_TIMEOUT | `cic-mesh hitl recover --gate-id <id>` |
| ERR-006 | CIRCUIT_BREAKER_OPEN | Identify failing downstream; await recovery |
| ERR-007 | AGENT_CRASH | Soft restart; inspect logs (§6.4) |
| ERR-009 | SAFETY_GATE_BLOCK | Escalate to AI Safety Officer |
| ERR-010 | TOOL_AUTH_FAILURE | Rotate credential (§10.4) |
| ERR-012 | MODEL_API_RATE_LIMIT | Switch to secondary endpoint (§6.9) |
| ERR-018 | CONNECTOR_OFFLINE | Re-authenticate connector (§6.10) |

---

## Appendix B: CLI Command Reference

| Command | Subcommand | Key Flags | Description | Access Level |
|---|---|---|---|---|
| `cic-mesh workflow` | `trigger` | `--intent, --profile, --ticket, --dry-run` | Trigger a new workflow | L1+ |
| `cic-mesh workflow` | `status` | `--id, --watch` | Get workflow status | L1+ |
| `cic-mesh workflow` | `list` | `--status, --profile, --since` | List workflows with filters | L1+ |
| `cic-mesh workflow` | `pause` | `--id` | Pause a workflow | L1+ |
| `cic-mesh workflow` | `resume` | `--id` | Resume a paused workflow | L1+ |
| `cic-mesh workflow` | `cancel` | `--id, --reason` | Cancel a workflow | L1+ |
| `cic-mesh workflow` | `pause-all` | `--tag` | Pause all workflows matching tag | L2+ |
| `cic-mesh workflow` | `rollback` | `--id, --to-checkpoint, --hard` | Roll back workflow to checkpoint | L2+ |
| `cic-mesh workflow` | `update` | `--id, --profile, --priority` | Update workflow properties | L2+ |
| `cic-mesh hitl` | `list` | `--status, --tier, --workflow-id` | List HITL gates | L1+ |
| `cic-mesh hitl` | `inspect` | `--gate-id` | View full gate details | L1+ |
| `cic-mesh hitl` | `approve` | `--gate-id, --rationale` | Approve a HITL gate | L1+ |
| `cic-mesh hitl` | `reject` | `--gate-id, --reason, --action` | Reject a HITL gate | L1+ |
| `cic-mesh hitl` | `modify` | `--gate-id, --field, --value` | Modify a gate's pending action | L1+ |
| `cic-mesh hitl` | `escalate` | `--gate-id, --to, --reason` | Escalate a gate to higher role | L1+ |
| `cic-mesh hitl` | `extend` | `--gate-id, --extension` | Extend gate timeout | L1+ |
| `cic-mesh hitl` | `recover` | `--gate-id` | Recover a timed-out gate | L1+ |
| `cic-mesh agent` | `status` | `--id` | Check agent health | L1+ |
| `cic-mesh agent` | `restart` | `--id, --soft/--hard, --ticket` | Restart an agent pod | L2+ |
| `cic-mesh agent` | `logs` | `--id, --tail, --since` | View agent logs | L1+ |
| `cic-mesh agent` | `list` | `--heartbeat-stale` | List agents; filter by health | L1+ |
| `cic-mesh profile` | `list` | — | List all runtime profiles | L1+ |
| `cic-mesh profile` | `show` | `--name` | Show full profile config | L1+ |
| `cic-mesh profile` | `override` | `--global, --reason, --ticket, --duration` | Emergency global profile override | L2+ |
| `cic-mesh retrieval` | `health` | — | Check retrieval subsystem health | L1+ |
| `cic-mesh retrieval` | `reindex` | `--config, --mode, --ticket` | Trigger index rebuild | L2+ |
| `cic-mesh retrieval` | `rollback` | `--config, --to-version` | Rollback retrieval config | L2+ |
| `cic-mesh logs` | `query` | `--level, --workflow-id, --event-type, --since` | Query structured logs | L1+ |
| `cic-mesh logs` | `export` | `--since, --format, --output` | Export logs to file | L1+ |
| `cic-mesh logs` | `stream` | `--workflow-id` | Live-stream workflow logs | L1+ |
| `cic-mesh mesh` | `circuit-breakers` | — | View all circuit breaker states | L1+ |
| `cic-mesh mesh` | `event-bus` | `status / queue-depth / consumer-lag` | Event bus health and metrics | L1+ |
| `cic-mesh mesh` | `drain` | `--timeout` | Gracefully drain all workflows | L3 only |
| `cic-mesh mesh` | `shutdown` | `--force, --reason, --ticket` | Emergency mesh shutdown | L3 only |
| `cic-mesh schedule` | `list` | — | List all scheduled workflows | L1+ |
| `cic-mesh schedule` | `update` | `--name, --cron, --profile` | Update scheduled workflow | L2+ |
| `cic-mesh config` | `set` | `--key, --value, --approve-with` | Set global config value | L2+ |
| `cic-mesh connector` | `status` | `--id, --all` | Check connector health | L1+ |
| `cic-mesh connector` | `reauth` | `--id, --credential-source` | Re-authenticate a connector | L2+ |
| `cic-mesh connector` | `rotate-credential` | `--id, --new-credential-ref, --strategy` | Rotate connector credential | L2+ |

---

## Appendix C: Alert Runbook Index

| Alert Name | Severity | Runbook Section | Owner Role |
|---|---|---|---|
| WORKFLOW_FAILURE_RATE_HIGH | P2 | §6.2, §6.3 | L1/L2 |
| HITL_GATE_TIMEOUT | P2 | §4.7 | L1 |
| HITL_GATE_BACKLOG | P2 | §6.7 | L2 |
| AGENT_HEARTBEAT_STALE | P2 | §6.4 | L1/L2 |
| CIRCUIT_BREAKER_OPEN | P2 | §6.3, §5.4 ERR-006 | L2 |
| EVENT_BUS_QUEUE_DEPTH_HIGH | P2 | §6.8 | L2 |
| RETRIEVAL_LATENCY_HIGH | P3 | §6.6 | L2 |
| RETRIEVAL_SCORE_LOW | P3 | §6.6 | L2/L3 |
| MODEL_API_RATE_LIMIT | P2 | §6.9 | L2 |
| CONNECTOR_OFFLINE | P2 | §6.10 | L2 |
| CONFIDENCE_SCORE_TREND_DOWN | P3 | §6.6, §7.6 | L2/L3 |
| SAFETY_POLICY_BLOCK_SPIKE | P1 | §9.3 | L2 + AI Safety Officer |
| PII_DETECTION_BLOCK | P1 | §9.3, §5.4 ERR-014 | L2 + AI Safety Officer |
| SCHEDULER_MISSED_EXECUTION | P3 | §6.5, §5.4 ERR-017 | L1/L2 |
| AGENT_CRASH | P2 | §6.4 | L2 |
| WORKFLOW_STATE_CORRUPTION | P1 | §9.4, §5.4 ERR-016 | L2/L3 |
| FALLBACK_CHAIN_EXHAUSTED | P1 | §6.11 | L3 |

---

## Appendix D: Change Control Templates

### D.1 Agent Onboarding Request

| Field | Value |
|---|---|
| Change ID | CHG-_____ |
| Change Title | Agent Onboarding: [Agent Name] |
| Requestor | |
| New Agent ID | |
| Capability Description | |
| Tools Requested | |
| HITL Required? | Yes / No |
| Risk Assessment | |
| SANDBOX Test Results | Success Rate: ___ Avg Confidence: ___ |
| Rollback Plan | Remove agent config; re-deploy previous workflow definitions |
| L3 Architect Approval | Name: _______ Date: _______ |
| AI Safety Officer Approval | Name: _______ Date: _______ |

### D.2 Safety Policy Change Request

| Field | Value |
|---|---|
| Change ID | CHG-_____ |
| Policy Element Being Changed | |
| Current Value | |
| Proposed Value | |
| Justification | |
| Risk Assessment | |
| Testing Performed | |
| Rollback Plan | |
| AI Safety Officer Approval | Name: _______ Date: _______ |
| L3 Architect Review | Name: _______ Date: _______ |

---

## Appendix E: Incident Report Template

| Field | Value |
|---|---|
| Incident ID | INC-_____ |
| Severity | P1 / P2 / P3 / P4 |
| Title | |
| Detected At | |
| Resolved At | |
| Duration | |
| Affected Workflows | Workflow IDs: ___ |
| Users/Services Impacted | |
| Timeline of Events | [Time] — [Event] (repeat per event) |
| Root Cause | |
| Contributing Factors | |
| Immediate Mitigations | |
| Long-Term Corrective Actions | Action \| Owner \| Due Date |
| Lessons Learned | |
| L2 Sign-off | Name: _______ Date: _______ |
| L3 Sign-off | Name: _______ Date: _______ |
| AI Safety Officer Sign-off | (if safety-related) Name: _______ Date: _______ |

---

## Appendix F: HITL Gate Decision Reference

| Trigger Condition | Gate Tier | Decision Guidance | Who Can Approve |
|---|---|---|---|
| Email to external recipient | CONFIRMATIONAL | Verify recipient, content, and scope. Reject if recipient unverified. | L1+ |
| File write to shared storage | CONFIRMATIONAL | Verify file path, content type, and access scope. | L1+ |
| Calendar event creation (external attendee) | CONFIRMATIONAL | Verify attendee list and event details match workflow intent. | L1+ |
| External API call (POST/DELETE) | BLOCKING | Verify API endpoint, payload, and reversibility. L2 required. | L2+ |
| Confidence below 0.65 | CONFIRMATIONAL | Review agent output for quality. Reject if output appears hallucinated. | L1+ |
| PII detected in output | BLOCKING | Do not approve until PII is reviewed and redaction confirmed. Escalate to AI Safety Officer. | L2 + Safety Officer |
| Action type: DELETE_RECORDS | BLOCKING | Verify record scope. Confirm backup exists. L3 required for bulk deletions. | L2+ (L3 for bulk) |
| New external domain contact | CONFIRMATIONAL | Verify domain is approved for external communication. | L1+ |
| Budget or financial data in output | BLOCKING | Verify accuracy and authorization for transmission. L2 required. | L2+ |
| Action flagged HIGH by SafetyGateAgent risk model | BLOCKING | Always escalate to AI Safety Officer for review before approval. | AI Safety Officer |

---

## Appendix G: Operator Onboarding Checklist

To be completed jointly by the new operator and their onboarding buddy (assigned L2 operator).

| # | Task | Details | Completed |
|---|---|---|---|
| 1 | System access provisioning | Submit onboarding ticket; await L3 approval; receive credentials | ☐ |
| 2 | MFA setup | Enroll authenticator app; verify MFA login on all systems | ☐ |
| 3 | Dashboard access verified | Log in to ops.cic-mesh.internal/prod; confirm all panels load | ☐ |
| 4 | CLI tool installed | Install cic-mesh CLI; verify `cic-mesh version` output matches current | ☐ |
| 5 | Required reading — Chapter 1 | Roles, responsibilities, RACI, access control | ☐ |
| 6 | Required reading — Chapter 2 | System overview, topology, normal operating state | ☐ |
| 7 | Required reading — Chapters 3–5 | Workflow management, HITL procedures, log interpretation | ☐ |
| 8 | Required reading — Chapter 9 | Safety procedures and rollback — mandatory before PROD access | ☐ |
| 9 | Shadow shift — Day 1 | Observe L2 operator for full 8h shift; no independent actions | ☐ |
| 10 | Shadow shift — Day 2 | Take first-line actions under L2 supervision | ☐ |
| 11 | HITL resolution practice | Resolve 5 supervised HITL gates with L2 review of each decision | ☐ |
| 12 | Log interpretation exercise | Trace 3 complete workflow logs from start to finish; present findings to L2 | ☐ |
| 13 | Certification test | Complete operator certification assessment (minimum 85% pass score) | ☐ |
| 14 | Solo shift readiness sign-off | L2 buddy signs off on solo shift readiness in onboarding system | ☐ |

---

## Appendix H: Glossary

| Term | Definition |
|---|---|
| Agent | An autonomous AI component within the CIC Mesh that performs a defined task using a language model, tools, and retrieval. Each agent has a single responsibility. |
| Agent Catalog | The internal registry documenting all registered agents, their capabilities, retrieval configs, and version history. |
| Checkpoint | A saved snapshot of a workflow's execution state, used for soft rollback and recovery after failures. |
| Circuit Breaker | A fault-tolerance pattern that stops calls to a failing downstream service after a threshold of failures, allowing it to recover. States: CLOSED (healthy), OPEN (blocking), HALF-OPEN (probing). |
| CIC Mesh | Cooperative Intelligence Cluster Mesh — the cooperative multi-agent AI system described in this handbook. |
| Confidence Score | A numerical value [0–1] representing an agent's internal assessment of its output quality. Values below the agent's threshold trigger escalation or HITL. |
| Connector | An integration component that connects the CIC Mesh to an external service (email, calendar, files, CRM, external APIs). |
| DORI Framework | The CIC Mesh troubleshooting methodology: Detect → Observe → Reason → Intervene → Validate. |
| Embedding Model | The AI model responsible for converting text into vector representations used by the retrieval system for semantic search. |
| Event Bus | The publish/subscribe message routing system that carries all inter-agent communications within the CIC Mesh. |
| Fallback Chain | An ordered list of alternative agents that are tried in sequence when a primary agent fails or produces low-confidence output. |
| HITL | Human-in-the-Loop — mandatory human review checkpoints inserted into workflow execution for consequential or uncertain actions. |
| HITL Gate | A specific checkpoint instance opened by the SafetyGateAgent. Has a tier (Informational, Confirmational, Blocking), a timeout, and requires operator resolution. |
| Intent | The natural language description of what a workflow should accomplish. The entry point for user-initiated and operator-initiated workflows. |
| Operator-Initiated Workflow | A workflow triggered manually by a mesh operator via CLI or API, rather than by a user or automated scheduler. |
| Prompt Registry | The versioned store of all agent system prompts. Every version is immutable once deployed. |
| Retrieval Config | The configuration defining which knowledge base an agent queries, including retrieval depth, similarity thresholds, and filtering rules. |
| Retrieval Score | A [0–1] relevance score returned by the vector store indicating how closely a retrieved document matches the query. Healthy threshold: >0.70. |
| Runtime Profile | A named configuration bundle controlling token budgets, retrieval depth, parallelism, timeout values, and HITL frequency. Standard profiles: FAST, BALANCED, THOROUGH, SCHEDULED, SAFE. |
| SafetyGateAgent | The safety enforcement agent in the CIC Mesh. Evaluates all consequential actions against safety policies and opens HITL gates as required. |
| Soft Rollback | Re-running a workflow from its last preserved checkpoint. Does not reverse completed side effects. |
| Hard Rollback | Cancelling a workflow entirely and initiating manual side-effect reversal. Used when checkpoints are unavailable or when side effects must be explicitly reviewed. |
| Task Graph | The directed execution graph produced by TaskGraphBuilder, defining which agents run, in what order, with what dependencies. |
| Token Budget | The maximum number of language model tokens an agent or workflow is permitted to consume in a single invocation or execution. |
| Trace ID | A unique identifier that links all log events across all agents for a single workflow execution. Essential for log correlation. |
| Vector Store | The database that stores vector embeddings of knowledge base documents, enabling semantic similarity search for retrieval. |
| Workflow | A complete, end-to-end execution of a task from intent to output, coordinated by the MasterOrchestrator across multiple agents. |

---

*CIC Mesh Operator Handbook v1.0  |  Classification: Internal Operational Reference  |  June 2026*

*Do not distribute outside of Platform Engineering and AI Operations teams without prior approval from the Mesh Architect team.*
