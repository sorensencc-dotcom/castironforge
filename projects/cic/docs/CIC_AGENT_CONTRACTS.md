# File: projects/cic/docs/CIC_AGENT_CONTRACTS.md

# Path: projects/cic/docs/CIC_AGENT_CONTRACTS.md

# Purpose: Formal contracts for all CIC agents (ingestion → audit)

# ============================================================

# CIC AGENT CONTRACTS

# ============================================================

This document defines the **strict, typed, deterministic contracts** for all CIC agents.
Each agent is a thin, stateless wrapper around a pipeline stage or core module.

Agents MUST:

- accept only the inputs defined here
- return only the outputs defined here
- never mutate global state
- never perform side effects outside their module
- never call premium models unless explicitly defined

Agents MAY:

- log internal metrics
- raise typed exceptions on invalid input

---

# 1. INGESTION AGENT

## File

`projects/cic/agents/ingestion_agent.py`

## Purpose

Fetch raw artifacts from URLs or local paths.

## Input

```python
List[str]  # list of URLs or file paths
Output
python
List[RawArtifact]
Contract
MUST call fetch_raw for each source.

MUST return artifacts in the same order as input.

MUST NOT perform enrichment or compression.

2. ENRICHMENT AGENT
File
projects/cic/agents/enrichment_agent.py

Purpose
Convert raw artifacts into enriched artifacts.

Input
python
List[RawArtifact]
Output
python
List[EnrichedArtifact]
Contract
MUST call entity, timeline, location, people, and reverse-image extractors.

MUST preserve artifact ordering.

MUST NOT call compression modules.

3. COMPRESSION AGENT
File
projects/cic/agents/compression_agent.py

Purpose
Run the compression pipeline and produce an EvidencePacket.

Input
python
topic_id: str
enriched: List[EnrichedArtifact]
Output
python
EvidencePacket
Contract
MUST call run_compression_pipeline.

MUST NOT call synthesis or audit modules.

MUST NOT modify enriched artifacts.

4. ORCHESTRATOR AGENT
File
projects/cic/agents/orchestrator_agent.py

Purpose
Route evidence to synthesis and audit based on decision graph.

Input
python
EvidencePacket
Output
python
{
  "synthesis": Optional[Dict],
  "audit": Optional[Dict],
  "decision": Dict
}
Contract
MUST call orchestrate.

MUST NOT call synthesis or audit directly.

MUST NOT modify EvidencePacket.

5. SYNTHESIS AGENT
File
projects/cic/agents/synthesis_agent.py

Purpose
Build narrative, resolve contradictions, and generate summary.

Input
python
EvidencePacket
Output
python
{
  "narrative": Dict,
  "contradictions": Dict,
  "summary": str
}
Contract
MUST call:

build_narrative

resolve_contradictions

generate_summary

MUST NOT call audit modules.

MUST NOT modify EvidencePacket.

6. AUDIT AGENT
File
projects/cic/agents/audit_agent.py

Purpose
Perform deterministic + model-based audit of narrative.

Input
python
EvidencePacket
synthesis_output: Dict
Output
python
{
  "audit_trace": AuditTrace,
  "contradictions": List[Dict],
  "scores": Dict[str, float]
}
Contract
MUST call audit_review.

MUST NOT modify EvidencePacket or synthesis output.

MUST NOT call synthesis modules.

7. AGENT EXECUTION ORDER
Agents MUST execute in the following strict order:

Code
1. ingestion_agent
2. enrichment_agent
3. compression_agent
4. orchestrator_agent
5. synthesis_agent (conditional)
6. audit_agent (conditional)
Conditional execution is determined by:

cross-source signals

decision graph rules

8. ERROR CONTRACT
Agents MUST raise typed exceptions:

InvalidInputError

MissingFieldError

ModelFailureError

PipelineContractError

Agents MUST NOT raise generic exceptions.

9. MODEL USAGE RULES
Agents MUST follow model tier rules:
| Agent | Allowed Model Tier |
| --- | --- |
| ingestion | none |
| enrichment | none |
| compression | cheap only |
| orchestrator | none |
| synthesis | reasoning + cheap |
| audit | reasoning + deterministic |
Premium models are never used in agents.

10. TESTING REQUIREMENTS
Each agent MUST have:

input validation tests

output schema tests

pipeline integration tests

failure-mode tests

Tests live under:

Code
projects/cic/tests/agents/
END OF DOCUMENTATION
