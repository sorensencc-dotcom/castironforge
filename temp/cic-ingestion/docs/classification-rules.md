# File Classification Rules

Deterministic rules used by the classifier (src/mover/classifier.js).

Primary strategy

1. Extension map: known extensions map to categories: photos, documents, audio, video, notes.
2. Mime-type fallback: if extension missing, mime-type prefixes (image/, audio/, video/) are used.
3. Default: files not matching rules map to `notes`.

Operator notes

- The mapping is intentionally conservative. To add or change mappings, edit `src/mover/classifier.js` and update docs.
- Categories must match `config/paths.json` categories array to ensure correct processed folder placement.
