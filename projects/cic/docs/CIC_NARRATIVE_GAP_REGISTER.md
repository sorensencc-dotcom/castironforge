# CIC Narrative Gap Register
**Version:** 1.0.0
**Date:** 2026-05-28
**Purpose:** Machine-readable tracking of research gaps for the Cast Iron Charlie documentary.

---

## 1. GAP SCHEMA
Every entry in this register must be machine-parsable to trigger autonomous `/goal` generation.

| Gap ID | Theme | Timeframe | Location | Description | Priority | Goal Status |
|---|---|---|---|---|---|---|
| GAP-001 | Willow Run | 1941-1945 | Detroit, MI | Specific details of Sorensen's 1943 visit to Willow Run and his interaction with Ford executives regarding B-24 production bottlenecks. | P0 | COMPLETE |
| GAP-002 | Danish Origins | 1881-1900 | Denmark | Records of the Sorensen family's emigration from Denmark to the US; specifically identifying the vessel and port of entry. | P1 | PENDING |
| GAP-003 | Civilian Jeep | 1944-1946 | Willow Run | Sorensen's role in the transition of Jeep production from military to civilian use. | P2 | PENDING |

---

## 2. GOAL MATERIALIZATION LOG
Tracks the transformation of Gaps into CIC `/goal` DSL instances.

| Date | Gap ID | Goal ID | Result |
|---|---|---|---|
| 2026-05-28 | GAP-001 | cic.harvester_v2.GAP-001 | SUCCESS |

---

## 3. USAGE INSTRUCTIONS
1. **Identify**: Research team identifies a narrative gap.
2. **Log**: Entry added to Section 1 with `PENDING` status.
3. **Trigger**: CIC Architect scans this file and generates a `cic.harvester_v2.gap_fill` goal.
4. **Update**: Once successful, the Goal Status is updated to `MATERIALIZED` or `COMPLETE`.
