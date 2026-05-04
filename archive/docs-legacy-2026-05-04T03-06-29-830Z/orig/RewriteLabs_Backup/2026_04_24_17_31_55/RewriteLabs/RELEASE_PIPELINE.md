# Rewrite Labs — Documentation Release Pipeline (CI/CD)

## 1. Purpose
Ensure all documentation updates follow a deterministic, auditable release process.

## 2. Pipeline Stages

### Stage 1 — Edit
- Operator updates document in working directory.

### Stage 2 — Versioning
- Increment version (PATCH/MINOR/MAJOR).
- Update CHANGELOG.md.
- Update version-manifest.json.

### Stage 3 — Validation
- Run Docs QA Checklist.
- Validate structure and formatting.
- Validate links and references.

### Stage 4 — Indexing
- Update INDEX.md.
- Update SITEMAP.md.

### Stage 5 — Backup
- Run docs-sync script (Windows or WSL).
- Validate backup integrity.

### Stage 6 — Console Sync
- Operator Console reloads manifest.
- UI updates version indicators.

### Stage 7 — Release
- Commit final version to Docs directory.
- Announce update in operator channel.

## 3. Failure Handling
- Version mismatch → Reconcile manifest + changelog.
- Missing changelog → Block release.
- Broken index → Regenerate INDEX.md + SITEMAP.md.
