# GEMINI.md — Operator Spec
# v1.0.0 | 2026-05-14

## 1. Profile: Chris Sorensen
- Architect. Automation engineer.
- Rewrite Labs. Cast Iron Productions.
- Stack: Node (ESM), React, TS, MCP, WSL2.
- Focus: Web redesign. "Cast Iron Charlie" doc.

## 2. Protocol: "Operator-Grade"
- Deterministic. No ambiguity.
- No fluff.
- Ready: Full paths + ESM + bash.
- Fail aware.

## 3. SkillOS
- Goal: Token efficiency.
- Contextual-Triage-v1: Logs > 1.5k → distill.
- Hybrid-Evolution: Peer (soft) / Operator (hard).
- Skills-Sync: `npm run skills:sync` start.

## 4. Standards
- ESM only (.js).
- Metadata: // File: [path] | Date: [YYYY-MM-DD] | v[X.X.X]
- Modularity: Isolated subsystems. SkillOpt integration redesign generation, telemetry.

---

# **CIC INSTRUCTIONS — HYBRID**

## **1. Hierarchy**
- SYSTEM → `CIC_SYSTEM.md` (architecture)
- STATE → `CIC_PROJECT_STATE.md` (status)
- Living docs: Kroll, Treatment, QuestionsForDad, Research Logs.

---

## **2. Workflow**
- Research → living docs.
- Status → STATE doc.
- System → SYSTEM doc.

---

## **3. Output**
- Deterministic. Modular.
- Versioned.
- verified/inferred/unknown.
- No filler.

---

## 4. Technical
- `catalog_ingest` local.
- No Drive lookup. Archive ONLY.
- Living Docs: /mnt/c/Users/soren/projects/cic/docs/living-docs/
- System: /mnt/c/Users/soren/projects/cic/docs/CIC_SYSTEM.md
- State: /mnt/c/Users/soren/projects/cic/docs/CIC_PROJECT_STATE.md
- Sync Layer: `npm run success:docs` (Google Drive / OneDrive sync).
- Linux paths only.
- Batch Operations: `node scripts/gap-manager.js <batch.json>` token GAP init.

---

## **5. Memory**
- No CIC state memory.
- Reference docs only.

---

## **6. Roles**
- Default: CIC‑RESEARCH (archival).
- Switch: CIC‑SYSTEM (pipeline).

---

## **7. Uncertainty**
- No info → unknown.
- One question.

---

## **8. Rules (Token‑Efficient)**
- New chat task.
- Prompts short, explicit.
- Specify output format.
- Deterministic schemas.
- Drift → restart.

---

## **9. Daily**
1. Fresh chat → instructions.
2. Declare intent.
3. Provide input.
4. Output format.
5. Update docs.
6. Reset task switch.
---

## **10. CIC UI Release Checklist v2.1**
- [ ] `node tools/cic-ui/drift-sentinel.cjs` (Shell + Nav checks)
- [ ] `node tools/cic-ui/integrity-validator.cjs` (Integrity + Theme checks)
- [ ] `node tools/cic-ui/smoke-tests.cjs` (Structure + Panel assertions)
- [ ] `node tools/cic-ui/golden-master.cjs verify` (Full UI Snapshot)
- [ ] `mkdocs build` (ensure site/ is synchronized with Forge Noir theme)
--- End of Context from: /mnt/c/Users/soren/GEMINI.md ---