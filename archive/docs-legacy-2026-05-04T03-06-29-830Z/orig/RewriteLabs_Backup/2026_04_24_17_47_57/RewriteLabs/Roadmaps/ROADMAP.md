# Rewrite Labs — Roadmap (Updated 2026-04-24)

## Completed
- Full documentation builder operational
- Search index generator implemented
- Linter integrated
- Version manifest auto-updater added
- Sitemap + index generators added
- Changelog auto-updater added
- Docs update pipeline created
- RewriteLabs documentation structure standardized
- Claude ingestion index updated

## New Additions (2026-04-24)
### Docs Health Dashboard
- Real-time validation of documentation completeness
- Missing files detection
- Broken link detection
- Orphaned folder detection
- Stale document detection

### Docs Integrity Checker
- Ensures every doc has metadata
- Ensures every folder has a CHANGELOG.md
- Ensures every doc is represented in INDEX.md, SITEMAP.md, version-manifest.json
- Ensures search index coverage

### Docs Operator Console
- Unified operator view of:
  - Last pipeline run
  - Pipeline logs
  - Docs health status
  - Manifest diffs
  - Search index status
- Trigger manual pipeline runs
- Trigger partial rebuilds

## In Progress
- Integrate Docs Health Dashboard into operator console
- Add Claude-triggered documentation refresh
- Add multi-AI ingestion alignment (Claude + Copilot + Wispr Flow)

## Upcoming
- Automated documentation summarization
- Automated documentation diff reports
- Documentation versioning system
- Rewrite Labs Portal v2 (AI-assisted navigation)
