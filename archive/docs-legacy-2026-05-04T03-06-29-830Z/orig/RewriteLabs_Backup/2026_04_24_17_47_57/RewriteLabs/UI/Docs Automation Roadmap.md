# Rewrite Labs — Docs Portal UI Specification

## 1. Purpose
Provide a standalone, web-based interface for browsing Rewrite Labs documentation.

## 2. Architecture
- Static HTML/CSS/JS
- Reads search-index.json
- Renders .md and .txt files
- No backend required

## 3. Layout

-----------------------------------------
| Sidebar | Document Viewer | Metadata  |
-----------------------------------------

### Sidebar
- Mirrors SITEMAP.md
- Collapsible sections
- Search bar with autocomplete

### Document Viewer
- Markdown rendering
- Syntax highlighting
- Collapsible headings
- Inline navigation

### Metadata Panel
- Version
- Last updated
- Path
- Related documents
- Changelog link

## 4. Features
- Full-text search
- Version drift warnings
- Quick actions:
  - Open Master Manual
  - Open Roadmap
  - Open Outreach Playbook
- Dark mode
- Keyboard shortcuts

## 5. Future Enhancements
- AI-assisted doc lookup
- Inline diff viewer
- Operator annotations
