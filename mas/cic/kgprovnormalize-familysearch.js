// kgprovnormalize-familysearch.js — 2026-06-22 — v1.0.0

export function normalizeFamilySearchProvenance({ provenance }) {
  return provenance.map(p => ({
    id: p.id,
    source: "familysearch",
    type: p.type ?? "UNKNOWN",
    timestamp: p.timestamp ?? Date.now(),
    weight: p.weight ?? 0.5,
    canonicalId: `fs-prov:${p.id}`
  }));
}
