// lineagecompress-familysearch.js — 2026-06-22 — v1.0.0

export function compressFamilySearchLineage({ lineage }) {
  return lineage.map(p => ({
    id: p.id,
    n: p.name,
    b: p.birth,
    d: p.death,
    p: p.parents ?? [],
    c: p.children ?? [],
    r: (p.records ?? []).length
  }));
}
