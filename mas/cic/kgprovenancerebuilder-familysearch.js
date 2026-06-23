// kgprovenancerebuilder-familysearch.js — 2026-06-22 — v1.0.0

export function rebuildFamilySearchProvenance({ lineage, evidence }) {
  const chain = [];

  for (const p of lineage) {
    chain.push({
      id: p.id,
      type: "PERSON",
      timestamp: Date.now(),
      source: "familysearch",
      recordCount: p.records?.length ?? 0
    });
  }

  for (const e of evidence) {
    chain.push({
      id: e.sourceId,
      type: e.type,
      timestamp: Date.now(),
      source: "familysearch",
      weight: e.weight
    });
  }

  return chain;
}
