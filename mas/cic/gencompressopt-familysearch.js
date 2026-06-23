// gencompressopt-familysearch.js — 2026-06-22 — v1.0.0

export function optimizeFamilySearchGenerationalCompression({ compressed }) {
  return compressed.map(p => ({
    id: p.id,
    n: p.n,
    b: p.b,
    d: p.d,
    p: p.p ?? [],
    c: p.c ?? [],
    r: p.r ?? 0
  }));
}
