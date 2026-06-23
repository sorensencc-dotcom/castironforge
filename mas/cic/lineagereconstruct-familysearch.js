// lineagereconstruct-familysearch.js — 2026-06-22 — v1.0.0

export function reconstructFamilySearchLineage({ nodes, relations }) {
  const lineage = [];

  const map = new Map(nodes.map(n => [n.id, { ...n, parents: [], children: [] }]));

  for (const r of relations) {
    if (r.type === "PARENT_OF") {
      map.get(r.from)?.children.push(r.to);
      map.get(r.to)?.parents.push(r.from);
    }
  }

  for (const entry of map.values()) {
    lineage.push(entry);
  }

  return lineage;
}
