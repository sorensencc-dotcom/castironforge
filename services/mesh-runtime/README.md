# Mesh Runtime

Node 20+ dispatcher for the CIC autonomous workflow mesh.

Loads workflow, agent, profile, and retrieval specs from the repo; invokes Claude agents via the Anthropic SDK; executes steps in dependency order; enforces HITL gates.

## Setup

```bash
npm install
cp .env.example .env
# Edit .env with your ANTHROPIC_API_KEY
npm start
```

## Triggering a Workflow

POST to `http://localhost:3000/`:

```json
{
  "workflow_id": "pr_review_pipeline",
  "trigger_event": {
    "event": "pull_request.opened",
    "pr": {
      "number": 5,
      "diff": "...",
      "code": "...",
      "branch": "claude/feature-xyz"
    }
  }
}
```

Response on success:

```json
{
  "status": "success",
  "workflow_id": "pr_review_pipeline",
  "stepOutputs": {
    "review": {...},
    "tests": {...},
    "cic_build": {...}
  }
}
```

If a HITL gate blocks:

```json
{
  "status": "awaiting_approval",
  "workflow_id": "pr_review_pipeline",
  "step": "synthesize_roadmap_from_pr",
  "stepOutputs": {...}
}
```

## Architecture

- `loader.js` — loads YAML specs from `agents/`, `workflows/`, `profiles/`, `retrieval/`
- `agent-runner.js` — invokes Claude via Anthropic SDK
- `workflow-executor.js` — topological sort + step execution + HITL gates
- `templates.js` — resolves `${{ }}` variable references
- `graph.js` — Kahn's algorithm for DAG ordering
- `logger.js` — structured JSON logs

## Logs

All output is structured JSON for easy parsing:

```json
{"ts":"2026-06-17T...Z","level":"info","event":"agent_invoke_start","agent_id":"pr_reviewer"}
{"ts":"2026-06-17T...Z","level":"info","event":"agent_invoke_success","agent_id":"pr_reviewer","output_keys":["issues","suggestions"]}
```
