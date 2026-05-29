# CIC Phase 4 Governance — Technical Spec
# v1.0.0 | 2026-05-23

## 1. Overview
Phase 4 introduces **Autonomous Governance Agents** that monitor the system's safety, cost, and performance. These agents are pure-function analyzers that sit outside the primary data flow but are integrated into the Orchestrator's lifecycle.

## 2. Governance Agents

### 2.1 SecuritySentinelAgent
**Purpose**: A zero-trust security perimeter for ingestion artifacts and agent outputs.
- **Logic**: Deterministic scanning for malicious URLs, script injections, and prompt injections.
- **Integrity**: Cross-references synthesis outputs against source blocks to detect hallucinated URLs.
- **Actions**: Can trigger quarantines, block outputs, or flag policy violations.

### 2.2 TokenEconomyAgent
**Purpose**: Real-time governance of cost, latency, and routing effectiveness.
- **Logic**: Analyzes LLM telemetry and routing events.
- **Monitoring**: Detects token leaks (spikes), latency inflation, and prompt inefficiencies.
- **Recommendations**: Suggests model switches, prompt compression, or profile optimizations.

## 3. Integration
Governance agents are called by the Orchestrator (`src/orchestrator/orchestrator.p3.ts`):
- **Immediate Ingestion Check**: Security sentinel runs right after ingestion.
- **Final Governance Phase**: Both agents run after synthesis to provide a final safety and economy report.

## 4. Telemetry Collection
The LLM layer (`src/llm/llmClient.p3.ts`) now provides standardized `PromptTelemetry` which is collected by the Orchestrator and passed to the TokenEconomyAgent.

## 5. Verification
Governance logic is verified using dedicated test suites:
```bash
npx tsx src/p4/governance.test.ts
```

## 6. Governance Dashboard
The **Operator Cockpit** provides a real-time view of the system's health, cost, and safety status.

### 6.1 Data Model
The dashboard consumes a `GovernanceSnapshot` (`src/types/governanceDashboard.ts`) which synthesizes:
- **Token Economy Health**: Latency, token usage, and alerts per agent.
- **Security Perimeter**: Threat counts, recent events, and quarantined items.
- **Routing Intelligence**: Model usage distribution and fallback events.
- **Pipeline Integrity**: Success rates and failure points across the pipeline.

### 6.2 Aggregator
The `dashboardAggregator.ts` module provides the `buildGovernanceSnapshot` pure function, which aggregates data from telemetry, routing, security, and pipeline stores.

### 6.3 API Endpoint
- `GET /api/governance/dashboard`: Returns the latest synthesized snapshot.

### 6.4 Frontend (Operator UI)
The frontend is a React-based grid dashboard located in `apps/operator-ui`.
- **Styling**: Vanilla CSS in `css/governance.css` (GitHub-dark aesthetic).
- **Components**: `js/components/GovernanceDashboard.js`.
- **Polling**: Real-time updates every 10 seconds via API polling.

## 7. Operator Command & Control
Ultimate authority rests with the operator via the **Command Console**.

### 7.1 Routing Console
- **Purpose**: Manual override of model selection per agent profile.
- **Logic**: Overrides the autonomous `ROUTING_TABLE` in the LLM layer.
- **API**: `POST /api/governance/routing/override`.

### 7.2 Policy Controls
- **Purpose**: Whitelisting specific patterns (URLs, entities) to bypass Security Sentinel alerts.
- **Logic**: Threats matching whitelisted patterns are ignored during detection.
- **API**: `POST /api/governance/policy/whitelist`.

### 7.3 Persistence
Overrides are managed by the `governanceStore.js` and reflected in real-time across the system via the `GovernanceEventBus`.

