# GEMINI.md — Operator Spec
# v1.0.0 | 2026-05-14

## 1. Profile: Chris Sorensen
- Architect. Automation Engineer.
- Rewrite Labs. Cast Iron Productions.
- Stack: Node (ESM), React, TS, MCP, WSL2.
- Focus: Web redesign. "Cast Iron Charlie" doc.

## 2. Protocol: "Operator-Grade"
- Deterministic. No ambiguity.
- No fluff.
- Ready: Full paths + ESM + bash.
- Failure-Aware.

## 3. SkillOS
- Goal: Token efficiency.
- Contextual-Triage-v1: Logs > 1.5k → distill.
- Hybrid-Evolution: Peer (Soft) / Operator (Hard).
- Skills-Sync: `npm run skills:sync` start.

## 4. Standards
- ESM Only (.js).
- Metadata: // File: [path] | Date: [YYYY-MM-DD] | v[X.X.X]
- Modularity: Isolated subsystems. SkillOpt integration for redesign generation and telemetry.

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
- Sync Layer: `npm run success:docs` (Google Drive / OneDrive bidirectional sync).
- Linux paths exclusive.
- Batch Operations: `node scripts/gap-manager.js <batch.json>` for token-efficient GAP initialization.

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