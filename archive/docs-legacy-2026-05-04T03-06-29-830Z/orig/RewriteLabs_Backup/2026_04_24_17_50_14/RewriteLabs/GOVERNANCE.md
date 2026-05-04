# Rewrite Labs — Documentation Governance Policy

## 1. Purpose
Ensure all documentation remains accurate, versioned, discoverable, and operator‑grade.

## 2. Roles
### Documentation Owner
- Maintains structure, versioning, and consistency.
- Approves MAJOR updates.

### Contributors
- May submit MINOR or PATCH updates.
- Must follow formatting and versioning rules.

### Reviewers
- Validate accuracy, clarity, and operator‑grade tone.

---

## 3. Update Workflow
1. Edit document in working copy.
2. Increment version (PATCH/MINOR/MAJOR).
3. Update CHANGELOG.md.
4. Update version-manifest.json.
5. Submit for review (if MAJOR or MINOR).
6. Commit to Docs directory.

---

## 4. Formatting Standards
- Deterministic structure.
- Clear headings.
- No filler language.
- Operator‑grade clarity.
- Consistent terminology across manuals, roadmaps, and playbooks.

---

## 5. Approval Rules
- **MAJOR** → Requires Documentation Owner approval.
- **MINOR** → Requires Reviewer approval.
- **PATCH** → Self‑approved but must be logged.

---

## 6. Enforcement
- Weekly audit of version-manifest.json.
- Quarterly documentation review.
- Any unversioned or unindexed document is flagged.
