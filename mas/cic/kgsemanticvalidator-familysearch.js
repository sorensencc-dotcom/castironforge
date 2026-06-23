// kgsemanticvalidator-familysearch.js — 2026-06-22 — v1.0.0

export function validateFamilySearchKGSemantics({ nodes, edges }) {
  const issues = [];

  // Rule: Birth must precede death
  for (const n of nodes) {
    if (n.birth && n.death) {
      const b = parseInt(n.birth);
      const d = parseInt(n.death);
      if (d < b) {
        issues.push({
          type: "INVALID_LIFESPAN",
          id: n.id,
          birth: n.birth,
          death: n.death
        });
      }
    }
  }

  // Rule: Parent must be older than child
  for (const e of edges) {
    if (e.type === "PARENT_OF") {
      const parent = nodes.find(n => n.id === e.from);
      const child = nodes.find(n => n.id === e.to);
      if (parent?.birth && child?.birth) {
        const gap = parseInt(child.birth) - parseInt(parent.birth);
        if (gap < 12) {
          issues.push({
            type: "SEMANTIC_PARENT_CHILD_AGE_CONFLICT",
            parentId: parent.id,
            childId: child.id,
            gap
          });
        }
      }
    }
  }

  return issues;
}
