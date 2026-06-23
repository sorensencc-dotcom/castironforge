// kgreducel-familysearch.js — 2026-06-22 — v1.0.0

export function eliminateFamilySearchKGRedundancy({ nodes, edges }) {
  const uniqueNodes = new Map();
  const uniqueEdges = new Set();

  // Deduplicate nodes by canonical signature
  for (const n of nodes) {
    const sig = `${n.name}|${n.birth}|${n.death}`;
    if (!uniqueNodes.has(sig)) {
      uniqueNodes.set(sig, n);
    }
  }

  // Deduplicate edges by (from,to,type)
  const dedupEdges = [];
  for (const e of edges) {
    const key = `${e.from}:${e.to}:${e.type}`;
    if (!uniqueEdges.has(key)) {
      uniqueEdges.add(key);
      dedupEdges.push(e);
    }
  }

  return {
    nodes: [...uniqueNodes.values()],
    edges: dedupEdges
  };
}
