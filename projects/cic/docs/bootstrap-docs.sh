#!/usr/bin/env bash
set -euo pipefail

echo "== Rewrite Labs DOC BOB Bootstrap =="

ROOT_DIR="$(pwd)"
DOCS_DIR="$ROOT_DIR/docs"
WORKFLOWS_DIR="$ROOT_DIR/.github/workflows"

echo "Creating directory structure..."
mkdir -p "$DOCS_DIR"/{manuals,roadmaps,playbooks,architecture,templates,state}
mkdir -p "$DOCS_DIR/manuals/master-instructions-manual/v1.1"
mkdir -p "$DOCS_DIR/roadmaps/master-roadmap/v1.1"
mkdir -p "$DOCS_DIR/playbooks/outreach-automation/v1.0"
mkdir -p "$WORKFLOWS_DIR"

echo "Writing base docs..."
cat > "$DOCS_DIR/index.md" << 'EOF'
# Rewrite Labs Documentation

Welcome to the living documentation system for Rewrite Labs.
EOF

cat > "$DOCS_DIR/VERSIONING.md" << 'EOF'
# Versioning Policy

This documentation uses **mike** for versioned releases.
EOF

cat > "$DOCS_DIR/CHANGELOG.md" << 'EOF'
# Changelog

All documentation changes are tracked here.
EOF

cat > "$DOCS_DIR/manuals/master-instructions-manual/v1.1/manual.md" << 'EOF'
# Master Instructions Manual v1.1
EOF

cat > "$DOCS_DIR/roadmaps/master-roadmap/v1.1/roadmap.md" << 'EOF'
# Master Roadmap v1.1
EOF

cat > "$DOCS_DIR/playbooks/outreach-automation/v1.0/playbook.md" << 'EOF'
# Outreach Automation Playbook v1.0
EOF

cat > "$DOCS_DIR/architecture/system-overview.md" << 'EOF'
# System Overview
EOF

cat > "$DOCS_DIR/architecture/pipeline.md" << 'EOF'
# Rewrite Labs Pipeline Architecture
EOF

cat > "$DOCS_DIR/architecture/agents.md" << 'EOF'
# Agent Architecture
EOF

cat > "$DOCS_DIR/templates/redesign-brief-template.md" << 'EOF'
# Redesign Brief Template
EOF

cat > "$DOCS_DIR/templates/outreach-email-template.md" << 'EOF'
# Outreach Email Template
EOF

cat > "$DOCS_DIR/state/rewrite-labs-state.md" << 'EOF'
# Rewrite Labs State
EOF

echo "Writing mkdocs.yml..."
cat > "$ROOT_DIR/mkdocs.yml" << 'EOF'
site_name: Rewrite Labs Documentation
site_url: https://rewrite-docs.yourdomain.com
repo_url: https://github.com/sorensencc-dotcom/rewrite-mcp
repo_name: rewrite-mcp

theme:
  name: material
  palette:
    scheme: slate
    primary: teal
    accent: lime
  features:
    - navigation.instant
    - navigation.tracking
    - navigation.sections
    - navigation.expand
    - toc.integrate
    - content.code.copy
    - content.action.edit
    - search.suggest
    - search.highlight
    - search.share

nav:
  - Home: index.md
  - Manuals:
      - Master Instructions Manual: manuals/master-instructions-manual/v1.1/manual.md
  - Roadmaps:
      - Master Roadmap: roadmaps/master-roadmap/v1.1/roadmap.md
  - Playbooks:
      - Outreach Automation: playbooks/outreach-automation/v1.0/playbook.md
  - Architecture:
      - System Overview: architecture/system-overview.md
      - Pipeline: architecture/pipeline.md
      - Agents: architecture/agents.md
  - Templates:
      - Redesign Brief: templates/redesign-brief-template.md
      - Outreach Email: templates/outreach-email-template.md
  - State:
      - Rewrite Labs State: state/rewrite-labs-state.md
  - Versioning: VERSIONING.md
  - Changelog: CHANGELOG.md

plugins:
  - search
  - mike

markdown_extensions:
  - admonition
  - toc:
      permalink: true
  - footnotes
  - def_list
  - attr_list
  - md_in_html
EOF

echo "Writing Cloudflare Pages CI/CD workflow..."
cat > "$WORKFLOWS_DIR/docs.yml" << 'EOF'
name: Build & Deploy Docs

on:
  push:
    branches:
      - main
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.11"

      - name: Install dependencies
        run: |
          pip install mkdocs-material mike

      - name: Build docs
        run: mkdocs build --clean

      - name: Publish to Cloudflare Pages
        uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: rewrite-docs
          directory: site
EOF

echo "Bootstrap complete."
echo "Next steps:"
echo "1. Add Cloudflare secrets: CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID"
echo "2. Run: pip install mkdocs-material mike"
echo "3. Run: mkdocs serve"
echo "4. Commit + push to main"
