// generationalgraph-familysearch.js — 2026-06-22 — v1.0.0

export function buildFamilySearchGenerationalGraph({ relations, nodes }) {
  const graph = {};

  // Initialize graph nodes
  for (const n of nodes) {
    graph[n.id] = {
      id: n.id,
      name: n.name,
      parents: [],
      children: []
    };
  }

  // Populate parent/child relationships
  for (const r of relations) {
    if (r.type === "PARENT_OF") {
      graph[r.from].children.push(r.to);
      graph[r.to].parents.push(r.from);
    }
  }

  return graph;
}
