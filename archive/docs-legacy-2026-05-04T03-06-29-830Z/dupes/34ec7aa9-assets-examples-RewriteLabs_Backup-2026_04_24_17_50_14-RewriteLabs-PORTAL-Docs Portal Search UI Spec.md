# Rewrite Labs — Docs Portal Search UI Specification

## 1. Purpose
Provide a deterministic, high‑performance search interface for the Rewrite Labs Docs Portal.  
The Search UI must allow operators to instantly locate documents, sections, and metadata across the entire documentation system.

## 2. UI Layout

-----------------------------------------
| Search Bar                             |
-----------------------------------------
| Filters (Collapsible)                  |
-----------------------------------------
| Search Results Panel                   |
-----------------------------------------
| Document Preview (Optional)            |
-----------------------------------------

### Components
- Search Bar (top)
- Filters Panel (left or collapsible)
- Results List (center)
- Optional Preview Pane (right)

---

## 3. Search Bar Specification

### Behavior
- Autocomplete using:
  - search-index.json
  - INDEX.md
  - SITEMAP.md
- Debounced input (150ms)
- Supports:
  - free‑text search
  
---

## 4. Filters Panel

### Filter Categories
- Document Type
  - Manuals
  - Roadmaps
  - Playbooks
  - Templates
  - Architecture
  - Logs & Reports
- Version
  - Latest only
  - Show all versions
- Subsystem Tags
  - Outreach
  - Pipeline
  - Operator Console
  - Architecture
  - Governance
  - Versioning
- Last Updated
  - Last 7 days
  - Last 30 days
  - Last 90 days
  - All time

### Behavior
- Multi-select
- Collapsible
- Sticky on scroll

---

## 5. Search Results Panel

### Result Item Structure
Each result displays:

- Document Title  
- File Path  
- Version  
- Last Updated  
- Snippet (first matching line or heading)  
- Relevance Score (hidden, used for sorting)

### Sorting Rules
1. Exact heading match  
2. Exact filename match  
3. Keyword density  
4. Recency  
5. Document type priority (Manuals > Playbooks > Roadmaps > Templates)

### Result Item Example
---

## 6. Document Preview Pane (Optional)

### Behavior
- Shows first 20 lines of the document
- Highlights matched keywords
- Clicking the preview loads full document in main viewer

### UI Elements
- Title
- Version
- Path
- Snippet preview
- “Open Document” button

---

## 7. Search Algorithm Specification

### Input
- Query string
- Active filters

### Steps
1. Tokenize query  
2. Match against:
   - headings
   - keywords
   - filenames
   - paths
3. Score results:
   - heading match = +50
   - filename match = +40
   - keyword match = +20
   - recency bonus = +10
4. Apply filters
5. Sort by score
6. Return top 50 results

---

## 8. Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Focus search | `/` |
| Clear search | `Esc` |
| Next result | `↓` |
| Previous result | `↑` |
| Open result | `Enter` |
| Toggle filters | `f` |

---

## 9. Error Handling

### No Results


### Index Missing
- Show alert: “Search index unavailable”
- Fallback to filename-only search

### Corrupted Index
- Show alert: “Search index corrupted”
- Suggest running search-index generator script

---

## 10. Future Enhancements
- Semantic search (AI-assisted)
- Inline diff viewer for version comparison
- Operator annotations in search results
- Search heatmap analytics
