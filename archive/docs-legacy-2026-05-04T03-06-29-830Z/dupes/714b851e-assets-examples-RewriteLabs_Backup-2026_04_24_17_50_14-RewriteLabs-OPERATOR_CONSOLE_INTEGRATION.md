# Rewrite Labs — Documentation Integration with Operator Console

## 1. Purpose
Provide deterministic access to all documentation from the Operator Console.

## 2. Integration Points
### A. Docs Sidebar
- Manuals
- Roadmaps
- Playbooks
- Templates
- Architecture
- Logs & Reports

### B. Quick Actions
- Open Master Manual
- Open Roadmap
- Open Outreach Playbook
- Search Docs Index
- View Version Manifest

---

## 3. Search Integration
- Indexes: INDEX.md, SITEMAP.md, version-manifest.json
- Searchable fields:
  - Document name
  - Version
  - Keywords
  - Subsystem tags

---

## 4. Version Awareness
- Console displays current version of each document
- Alerts operator if:
  - Version mismatch
  - Missing changelog
  - Unindexed document detected

---

## 5. Error Handling
### Document Not Found
- Console suggests nearest match
- Provides path from SITEMAP.md

### Version Conflict
- Console prompts operator to open CHANGELOG.md
- Suggests reconciliation steps

---

## 6. Future Enhancements
- Inline document previews
- AI-assisted doc search
- Auto-linking between manuals, roadmaps, and playbooks
