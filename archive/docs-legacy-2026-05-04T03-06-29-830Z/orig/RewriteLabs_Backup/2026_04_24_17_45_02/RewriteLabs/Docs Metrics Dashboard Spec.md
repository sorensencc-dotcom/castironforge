# Rewrite Labs — Docs Metrics Dashboard Specification

## 1. Purpose
Provide operators with real-time visibility into documentation health, usage, and version integrity.

## 2. Dashboard Panels

### A. Version Integrity Panel
- Total documents
- Up-to-date documents
- Version drift count
- Missing changelogs
- Unindexed documents

### B. Update Activity Panel
- Updates in last 7 days
- Updates by category (manuals, roadmaps, playbooks)
- MAJOR/MINOR/PATCH distribution

### C. Search Analytics Panel
- Top search queries
- Zero-result queries
- Most accessed documents
- Average search latency

### D. Backup Status Panel
- Last backup timestamp
- Backup integrity (hash match)
- Backup size
- Backup retention count

### E. Documentation Coverage Panel
- Manuals coverage %
- Roadmaps coverage %
- Playbooks coverage %
- Templates coverage %
- Architecture coverage %

---

## 3. Data Sources
- version-manifest.json
- INDEX.md
- SITEMAP.md
- Backup logs
- Search index logs

---

## 4. Alerts
- Version mismatch
- Missing changelog
- Backup failure
- Search index corruption

---

## 5. Future Enhancements
- Operator activity heatmap
- AI-driven doc quality scoring
- Predictive documentation gaps
