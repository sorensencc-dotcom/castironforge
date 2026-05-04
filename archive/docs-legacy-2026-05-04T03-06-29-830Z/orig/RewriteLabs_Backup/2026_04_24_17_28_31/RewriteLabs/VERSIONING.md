# Rewrite Labs — Documentation Versioning Policy

Rewrite Labs uses a deterministic, semantic versioning system for all documentation.

## 1. Version Format

Each document uses:
vMAJOR.MINOR.PATCH

### MAJOR
- Introduces new systems
- Changes structure or meaning
- Requires operator retraining

### MINOR
- Adds new sections
- Expands existing systems
- Introduces new SOPs or templates

### PATCH
- Fixes typos, formatting, or clarity
- Updates examples or diagrams
- Does not change meaning

---

## 2. Version Manifest

All documents must be listed in:
`/docs/RewriteLabs/version-manifest.json`

Each entry includes:
- Document name
- Current version
- Last updated date
- Change summary
- Operator responsible

---

## 3. Update Rules

- Every change must increment at least PATCH.
- MINOR increments require a changelog entry.
- MAJOR increments require operator approval.
- No document may be overwritten without version bump.
- All updates must be reflected in the Docs README.

---

## 4. Changelog Format

Each document includes a `CHANGELOG.md`:

### Example:
