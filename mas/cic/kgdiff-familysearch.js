// kgdiff-familysearch.js — 2026-06-22 — v1.0.0

export function diffFamilySearchKG({ oldKG, newKG }) {
  const addedNodes = newKG.nodes.filter(
    n => !oldKG.nodes.some(o => o.id === n.id)
  );

  const removedNodes = oldKG.nodes.filter(
    o => !newKG.nodes.some(n => n.id === o.id)
  );

  const addedEdges = newKG.edges.filter(
    e => !oldKG.edges.some(o => o.from === e.from && o.to === e.to && o.type === e.type)
  );

  const removedEdges = oldKG.edges.filter(
    o => !newKG.edges.some(e => e.from === o.from && e.to === o.to && e.type === o.type)
  );

  return {
    addedNodes,
    removedNodes,
    addedEdges,
    removedEdges
  };
}
