# Operator Console – Rewrite Labs
# File: docs/operator-console-spec.md
# Date: 2026-04-26
# Version: v1.1.0
# Moved from: operator-console/spec.md

---

## Purpose
Single control surface to:
- Start a pipeline run
- Monitor stage progress
- Inspect artifacts
- Copy outreach content

## Views

### 1. Run Launcher
- **Inputs:**
  - Target URL (text)
- **Actions:**
  - [Run Pipeline]
- **Behavior:**
  - On submit, set `TARGET_URL` and invoke `node pipeline/run.js`.

### 2. Run List
- Table of recent runs:
  - Run ID
  - Target URL
  - Status (Running / Complete / Failed)
  - Timestamp
- Clicking a run opens Run Detail.

### 3. Run Detail
- **Header:**
  - Run ID
  - Target URL
  - Status
- **Sections:**
  - Stage timeline:
    - 00-bootstrap
    - 10-crawl
    - 20-analyze
    - 30-redesign
    - 40-outreach
    - 50-export
  - Artifacts:
    - Links to `crawl.json`, `surface-map.json`, `redesign.json`, `outreach.json`, `bundle.json`
  - Outreach:
    - Email body (copy button)
    - SMS body (copy button)
    - Proposal summary (copy button)

## Implementation Notes
- Simple web UI (plain HTML/JS, no framework) or TUI.
- Backend reads `artifacts/runs/*` and streams logs from `pipeline-runner`.
- WebSocket transport preferred for live stage status updates (Castironforge WS layer).
- Data schemas in `schemas/` define artifact shapes for each stage.
