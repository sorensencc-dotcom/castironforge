# Rewrite Labs – Operator Runbook
# File: docs/runbook.md
# Date: 2026-04-26
# Version: v1.1.0
# Moved from: pipeline/runbook.md

---

## Prerequisites

- Node.js >= 20 installed
- Puppeteer dependencies satisfied (Chromium)
- Working directory: `rewrite-labs-core/`
- `TARGET_URL` — full URL of target site

## Step 1: Bootstrap a Run

```bash
RUN_ID=$(date +%s) TARGET_URL="https://targetsite.com" node pipeline/run.js
```

Stages execute in order:
1. `00-bootstrap` — validates env, creates run directory
2. `10-crawl` — Puppeteer crawl → `crawl.json` + `screenshot.png`
3. `20-analyze` — surface map → `surface-map.json`
4. `30-redesign` — redesign blueprint → `redesign.json`
5. `40-outreach` — outreach package → `outreach.json`
6. `50-export` — bundles all → `export/bundle.json`

## Step 2: Review Artifacts

```
artifacts/runs/<runId>/
  crawl.json
  surface-map.json
  redesign.json
  outreach.json
  screenshot.png
  export/bundle.json
```

## Step 3: Approve Redesign

Open `redesign.json` and verify `layout` + `components` fields.

## Step 4: Send Outreach

Use `outreach.json` → `email`, `sms`, `proposal` fields.

## Step 5: Export Deliverables

Final bundle: `artifacts/runs/<runId>/export/bundle.json`

## Failure Recovery

All stages log structured JSON. On failure:
1. Check the last log line for `"message": "... failed"` and `"context": { "error": "..." }`
2. Identify the failing stage from `"module"` field
3. Fix the root cause (env var, missing file, network error)
4. Re-run with the same `RUN_ID` to resume from the failed stage

## Adding a New Stage

1. Copy `pipeline/_template/` to `pipeline/NN-name/`
2. Rename `module` identifier in the log function
3. Add `"NN-name"` to the `stages` array in `pipeline/run.js`
4. Implement stage logic
