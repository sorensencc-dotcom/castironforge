# Rewrite Labs — Docs Search Index Generator Specification

## 1. Purpose
Generate a unified search index for the Operator Console using all documentation sources.

## 2. Inputs
- INDEX.md
- SITEMAP.md
- version-manifest.json
- All .md and .txt files in the Docs directory

## 3. Output
search-index.json containing:
- Document titles
- Paths
- Versions
- Keywords
- Section headers
- Subsystem tags

## 4. Indexing Rules
- Extract H1/H2/H3 headings
- Extract keywords from section titles
- Include version metadata
- Include file path
- Include last updated date

## 5. Update Triggers
- Document added
- Document updated
- Version bump
- Folder structure change

## 6. Error Handling
- Missing file → Skip + log warning
- Corrupted file → Skip + flag operator
- Duplicate entry → Keep latest version

## 7. Future Enhancements
- Semantic search
- AI-assisted query expansion
- Inline preview snippets
