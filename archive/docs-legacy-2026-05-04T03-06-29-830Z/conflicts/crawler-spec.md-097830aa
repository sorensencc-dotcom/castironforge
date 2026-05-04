# Rewrite Labs – Crawler Specification
# File: docs/crawler-spec.md
# Date: 2026-04-26
# Version: v1.1.0
# Moved from: crawler/crawler-spec.md

---

## Purpose
Define the crawler subsystem behavior, inputs, outputs, and failure modes.

## Implementation
- **Engine:** Puppeteer (headless Chromium)
- **Stage:** `pipeline/10-crawl/index.js`
- **Trigger:** `RUN_ID` + `TARGET_URL` environment variables

## Inputs

| Variable | Required | Description |
|---|---|---|
| `RUN_ID` | Yes | Unique run identifier (timestamp or UUID) |
| `TARGET_URL` | Yes | Full URL of the target website |

## Outputs

Written to `artifacts/runs/{RUN_ID}/`:

| File | Description |
|---|---|
| `crawl.json` | URL, status, metadata, DOM snapshot, links, assets, screenshot paths |
| `screenshot.png` | Full-page viewport screenshot |

## crawl.json Schema

```json
{
  "url": "https://target.com",
  "status": "ok",
  "metadata": { "title": "Page Title" },
  "dom": "<html>...",
  "links": [],
  "assets": [],
  "screenshots": {
    "full": "screenshot.png",
    "viewport": "screenshot.png"
  }
}
```

## Failure Modes

| Condition | Behavior |
|---|---|
| `RUN_ID` not set | `throw Error("RUN_ID not set")` → exit 1 |
| `TARGET_URL` not set | `throw Error("TARGET_URL not set")` → exit 1 |
| Page load timeout | Puppeteer throws → caught, logged, exit 1 |
| Navigation error | Caught in main().catch, exit 1 |

## Timeout

Default: `{ waitUntil: "networkidle2", timeout: 10000 }` (10 seconds)
