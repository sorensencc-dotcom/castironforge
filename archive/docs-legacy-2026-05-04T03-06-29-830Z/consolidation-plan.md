Consolidation Plan — Docs Migration

Timestamp: 2026-05-04T03:45:00Z
Archive root: archive/docs-legacy-2026-05-04T03-06-29-830Z

Goal
- Consolidate obvious duplicates and make /docs the single canonical documentation root.

Summary of recommended actions (top duplicate groups)
1) Docs Architecture Diagram group (15 duplicates)
   - Canonical: docs/assets/examples/RewriteLabs_Backup/2026_04_24_16_59_59/RewriteLabs/ARCHITECTURE/Docs Architecture Diagram.md
   - Action: keep canonical, leave all others in archive/dupes for historical record. No merge required unless content differs.

2) Docs API Wiring / portal.js group (15 duplicates)
   - Canonical: docs/assets/examples/RewriteLabs_Backup/2026_04_24_16_59_59/RewriteLabs/OPERATOR_CONSOLE/Docs API Wiring.md
   - Action: keep canonical; archive others remain.

3) CHANGELOG groups (multiple groups, up to 13 duplicates)
   - Canonical: docs/assets/examples/RewriteLabs/AI/CHANGELOG.md (and per-backup canonical listed in review-results.json)
   - Action: keep canonical files under docs/assets/examples; keep others archived. Consider creating a single consolidated top-level CHANGELOG per major component if maintainers request.

4) Other high-count backup duplicates (Docs AI Integration, Docs API Specification, BACKUP_POLICY, Metrics Dashboard, Search Index Generator, etc.)
   - Action: keep canonical backup copy under docs/assets/examples/RewriteLabs_Backup/<timestamp> and do not merge duplicates.

Principles
- Do not delete archived duplicates; keep them under archive/dupes for provenance.
- Only merge files when content differs and a human reviewer approves a synthesized document.
- For repeated CHANGELOGs, consider generating an index page that links to per-component CHANGELOGs rather than merging content.

Next steps
- Auto-consolidation already performed: non-canonical duplicates moved to archive/dupes (see dedupe-report.json).
- Manual review needed for a small set (see merge-candidates.json -> manual_review and conflict-classification.json -> manual_review).
- If maintainers want, create consolidated CHANGELOG index pages and remove per-backup duplicates from /docs assets (archives retained).

Files of interest
- review-results.json (list of top groups): archive/review-results.json
- dedupe-report.json: archive/dedupe-report.json
- merge-candidates.json: archive/merge-candidates.json
- rename-log.json: archive/rename-log.json

Approved-by: Migration automation

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
