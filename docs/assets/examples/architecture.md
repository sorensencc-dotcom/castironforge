# Rewrite Labs – Technical Architecture
# File: docs/architecture.md
# Date: 2026-04-26
# Version: v1.1.0
# Moved from: architecture/technical-architecture-v1.0.md

---

## Purpose
Define the system-level architecture for Rewrite Labs: an automated pipeline that discovers outdated websites, redesigns them using AI, and generates outreach-ready deliverables.

## Core Components

- **Crawler Engine**
  Headless browser crawler (Puppeteer) that scans target domains, extracts structure, captures screenshots, and collects metadata.

- **Analysis Engine**
  AI-driven surface map generator that identifies UX issues, layout patterns, content gaps, and modernization opportunities.

- **Redesign Engine**
  Prompt-driven system that produces wireframes, layout recommendations, component lists, and implementation notes.

- **Outreach Engine**
  Template-based generator that produces personalized outreach emails, proposals, and before/after comparisons.

- **Operator Console**
  Unified interface for triggering crawls, reviewing redesigns, exporting deliverables, and managing pipeline runs.

## Data Flow

1. **Discover** → Crawler collects site data
2. **Analyze** → AI generates surface map
3. **Redesign** → AI produces redesign blueprint
4. **Deliver** → Outreach engine generates client-ready materials

## Storage

- JSON artifacts for each stage
- Screenshots and assets stored per-domain
- Versioned under Git for reproducibility

## Execution Model

- Node.js ESM-only micro-tools
- Modular prompts in config/
- Deterministic operator-grade logging
- No silent failures

## Directory Map

```
pipeline/         Executable stage scripts (00-bootstrap through 50-export)
schemas/          Project-wide JSON data contracts
config/           AI prompts and runtime configuration
docs/             All technical and operational documentation
business/         Business plans and financial documents
operations/       Internal operational documents
research/         Research logs and summaries
scripts/          Setup and admin scripts
artifacts/        Runtime pipeline output (gitignored)
```
