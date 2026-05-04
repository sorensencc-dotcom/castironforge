# Rewrite Labs — Documentation API Specification

## 1. Purpose
Provide a unified API for accessing, indexing, and querying Rewrite Labs documentation from internal tools, the Operator Console, and future platform components.

## 2. Base URL
/local/docs-api/

## 3. Endpoints

### GET /documents
Returns a list of all documents.

Response:
- name
- version
- path
- last_updated
- type (manual, roadmap, playbook, template, etc.)

### GET /documents/{id}
Returns full metadata + content for a specific document.

### GET /search?q={query}
Searches across:
- INDEX.md
- SITEMAP.md
- version-manifest.json
- All .md and .txt files

### GET /manifest
Returns version-manifest.json.

### GET /changelog/{document}
Returns CHANGELOG.md for the specified document.

### GET /related/{document}
Returns related documents based on:
- subsystem tags
- shared keywords
- roadmap references

---

## 4. Data Model

### Document
- id
- name
- version
- path
- type
- tags
- last_updated
- content (optional)

### SearchResult
- document_id
- snippet
- relevance_score

---

## 5. Error Handling
- 404 → Document not found
- 409 → Version mismatch
- 500 → Indexing failure

---

## 6. Security
- Local-only API
- No external network access
- Read-only endpoints

---

## 7. Future Enhancements
- Semantic search
- Inline diff API
- AI-assisted doc summarization
