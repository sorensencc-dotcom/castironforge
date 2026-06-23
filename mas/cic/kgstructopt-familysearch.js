// kgstructopt-familysearch.js — 2026-06-22 — v1.0.0

export function optimizeFamilySearchKGStructure({ nodes, edges }) {
  const optimizedEdges = [];
  const seen = new Set();

  // Deduplicate edges by (from,to,type)
  for (const e of edges) {
    const key = `${e.from}:${e.to}:${e.type}`;
    if (!seen.has(key)) {
      seen.add(key);
      optimizedEdges.push(e);
    }
  }

  // Remove orphan nodes (no edges)
  const connectedIds = new Set();
  for (const e of optimizedEdges) {
    connectedIds.add(e.from);
    connectedIds.add(e.to);
  }

  const optimizedNodes = nodes.filter(n => connectedIds.has(n.id));

  return { nodes: optimizedNodes, edges: optimizedEdges };
}
