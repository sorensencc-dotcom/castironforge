// kgstructcompress-familysearch.js — 2026-06-22 — v1.0.0

export function compressFamilySearchKGStructure({ nodes, edges }) {
  const compressedNodes = nodes.map(n => ({
    id: n.id,
    n: n.name,
    b: n.birth,
    d: n.death
  }));

  const compressedEdges = edges
    .filter(e => e.type === "PARENT_OF" || e.type === "SPOUSE_OF")
    .map(e => ({
      f: e.from,
      t: e.to,
      k: e.type === "PARENT_OF" ? "P" : "S"
    }));

  return { nodes: compressedNodes, edges: compressedEdges };
}
