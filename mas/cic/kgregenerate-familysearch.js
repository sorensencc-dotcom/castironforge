// kgregenerate-familysearch.js — 2026-06-22 — v1.0.0

export function regenerateFamilySearchKG({ compressedLineage, relations }) {
  const nodes = compressedLineage.map(p => ({
    id: p.id,
    name: p.n,
    birth: p.b,
    death: p.d,
    parents: p.p,
    children: p.c,
    recordCount: p.r
  }));

  const edges = relations.map(r => ({
    from: r.from,
    to: r.to,
    type: r.type
  }));

  return { nodes, edges };
}
