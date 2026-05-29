# CIC DESIGN SYSTEM v1.0 — MASTER SPECIFICATION
# Document ID: CIC-DESIGN-SYSTEM-v1.0
# Owner: CIC Design Authority
# Status: Active
# Scope: All CIC surfaces (UI, Docs, Slides, Social, Correspondence)

---

## 0. Purpose
The CIC Design System defines the **visual, structural, and semantic language** of the Cast Iron Charlie ecosystem.  
It ensures every CIC surface — dashboards, consoles, documents, slides, and communications — expresses a unified identity and operator‑grade clarity.

This system is **mandatory** for all CIC assets.

---

## 1. Foundations

### 1.1 Color System
**Industrial Palette**
- **Forge** — #1A1410 (primary background)  
- **Iron** — #2C2420 (elevated surfaces)  
- **Ember** — #C4501A (primary accent)  
- **Rust** — #8B3A1A (critical)  
- **Brass** — #B8922A (secondary accent)  
- **Ash** — #9A9088 (muted text)  
- **Bone** — #E8E0D4 (primary text)  

### 1.2 Typography
- **Playfair Display** — Display, H1–H2  
- **Libre Baskerville** — Body text  
- **Barlow Condensed** — UI labels, navigation, metrics  

### 1.3 Motion
- Subtle, linear transitions  
- No easing curves  
- No bounce or spring  
- Industrial, deterministic motion only  

---

## 2. Component Library (cic-*)

### 2.1 Core Components
- **cic-panel** — elevated container  
- **cic-alert / cic-alert-warn / cic-alert-danger** — callouts  
- **cic-stat / cic-stat-number / cic-stat-label** — metric blocks  
- **cic-pill / cic-pill-accent / cic-pill-muted** — inline semantic tags  
- **cic-grid** — responsive grid layout  

### 2.2 Component Rules
- Zero rounded corners  
- Brass or ember accents only  
- No shadows except industrial drop shadows (≤ 40px blur)  
- All components must be composable and deterministic  

---

## 3. Iconography (cic-icon-*)

### 3.1 Style
- SVG  
- 24×24 grid  
- Brass stroke  
- Ember fill accents  
- Geometric, minimal, industrial  

### 3.2 Required Icons
- Harvester  
- Orchestrator  
- Agent  
- Region  
- Telemetry  
- DLQ  
- API  
- Release  
- Diff  
- Terminal  
- Gear  
- Grid  

---

## 4. Layout System

### 4.1 Grid
- 12‑column responsive grid  
- Gaps: 8 / 16 / 24 / 32 px  

### 4.2 Spacing Scale
- XS: 4  
- S: 8  
- M: 16  
- L: 24  
- XL: 32  
- XXL: 48  

### 4.3 Shells
- **cic-shell-dashboard**  
- **cic-shell-docs**  
- **cic-shell-handbook**  
- **cic-shell-slide**  
- **cic-shell-social**  

Each shell defines margins, gutters, and typography defaults.

---

## 5. Documentation Templates (CIC-DOC-*)

### 5.1 Document Types
- Technical Specification  
- Architecture Document  
- Operator Handbook  
- Incident Report  
- Release Notes  
- API Reference  
- Research Memo  

### 5.2 Document Structure
- Title block (crest + metadata)  
- Executive summary  
- Core content  
- CIC component library usage  
- Glossary auto‑linking  
- Appendix  

---

## 6. Slide Templates (CIC-SLIDE-*)

### 6.1 Slide Types
- Executive Brief  
- Architecture Deep Dive  
- Release Overview  
- Roadmap Presentation  
- Incident Postmortem  

### 6.2 Slide Rules
- Brass title bar  
- Ember section markers  
- CIC crest watermark  
- Barlow Condensed for labels  
- Playfair Display for titles  

---

## 7. Social Media Templates (CIC-SOCIAL-*)

### 7.1 Templates
- Release announcement  
- Feature spotlight  
- Architecture teaser  
- Operator tip  
- Milestone update  

### 7.2 Rules
- Brass/ember palette  
- CIC crest  
- Grid‑aligned layout  
- High‑contrast typography  

---

## 8. Intelligence Integration

### 8.1 Glossary Auto‑Linker
All CIC terms must auto‑link to the glossary.

### 8.2 API Change Detector
All API docs must surface added/removed endpoints.

### 8.3 Release Intelligence
All releases must appear in:
- Timeline  
- Diff viewer  
- Bundle panel  
- Intelligence feed  

---

## 9. Governance
- CIC Design Authority (Owner)  
- [CIC Design Review Workflow](CIC_DESIGN_REVIEW_WORKFLOW.md)  
- [CIC Design Policy v1.0](CIC_DESIGN_POLICY.md)  
