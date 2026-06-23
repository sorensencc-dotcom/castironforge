// kgconstraintsolver-familysearch.js — 2026-06-22 — v1.0.0

export function solveFamilySearchKGConstraints({ nodes, edges }) {
  const violations = [];
  const fixes = [];

  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  for (const e of edges) {
    if (e.type !== "PARENT_OF") continue;

    const parent = nodeMap.get(e.from);
    const child = nodeMap.get(e.to);
    if (!parent || !child) continue;

    if (parent.birth && child.birth) {
      const gap = parseInt(child.birth) - parseInt(parent.birth);

      if (gap < 12) {
        violations.push({
          type: "PARENT_TOO_YOUNG",
          parentId: parent.id,
          childId: child.id,
          gap
        });

        fixes.push({
          action: "ADJUST_BIRTH_RANGE",
          target: parent.id,
          minYear: parseInt(child.birth) - 60,
          maxYear: parseInt(child.birth) - 12
        });
      }

      if (gap > 60) {
        violations.push({
          type: "PARENT_TOO_OLD",
          parentId: parent.id,
          childId: child.id,
          gap
        });

        fixes.push({
          action: "ADJUST_BIRTH_RANGE",
          target: parent.id,
          minYear: parseInt(child.birth) - 60,
          maxYear: parseInt(child.birth) - 12
        });
      }
    }
  }

  return { violations, fixes };
}
