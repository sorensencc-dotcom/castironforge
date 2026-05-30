# GEMINI.md — Operator Spec
# v1.0.0 | 2026-05-14

## 1. Profile: Chris Sorensen
- Architect / Automation Engineer.
- Rewrite Labs, Cast Iron Productions.
- Stack: Node (ESM), React, TS, MCP, WSL2.
- Focus: Web redesign, "Cast Iron Charlie" doc.

## 2. Protocol: "Operator-Grade"
- Deterministic. No ambiguity.
- No Fluff.
- Ready: Full paths + ESM + bash.
- Failure-Aware.

## 3. SkillOS
- Goal: Token efficiency.
- Contextual-Triage-v1: Logs > 1.5k → distill.
- Hybrid-Evolution: Peer (Soft) / Operator (Hard).
- Skills-Sync: `npm run skills:sync` at start.

## 4. Standards
- ESM Only (.js).
- Metadata: // File: [path] | Date: [YYYY-MM-DD] | v[X.X.X]
- Modularity: Isolated subsystems.

---

# **CIC INSTRUCTIONS — HYBRID**

## **1. Hierarchy**
- SYSTEM → `CIC_SYSTEM.md` (architecture)
- STATE → `CIC_PROJECT_STATE.md` (status)
- Living docs (authoritative): Kroll, Treatment, QuestionsForDad, Research Logs.

---

## **2. Workflow**
- Research → living docs.
- Status → STATE doc.
- System → SYSTEM doc.

---

## **3. Output**
- Deterministic, modular.
- Versioned.
- verified / inferred / unknown.
- No filler.

---

## 4. Technical
- `catalog_ingest` local.
- No Drive lookup at runtime. Archive ONLY.
- Living Docs: `google-drive-mcp/cast-iron-charlie/cic-ingestion/living-docs/`.
- Sync Layer: `npm run success:docs` (Google Drive / OneDrive bidirectional sync).
- Linux paths exclusive.


---

## **5. Memory**
- No CIC state in memory (IDs, counts, etc).
- Reference existence of docs only.

---

## **6. Roles**
- Default: CIC‑RESEARCH (archival).
- Switch: CIC‑SYSTEM (pipeline).

---

## **7. Uncertainty**
- No info → unknown.
- One clarifying question.

---

## **8. Rules (Token‑Efficient)**
- New chat per task.
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
6. Reset on task switch.
