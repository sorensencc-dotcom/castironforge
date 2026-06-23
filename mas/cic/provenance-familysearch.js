// provenance-familysearch.js — 2026-06-22 — v1.0.0

export function buildFamilySearchProvenance({ payload }) {
  const provenance = [];

  if (payload.person) {
    provenance.push({
      id: `fs-person-${payload.person.id}`,
      source: "familysearch",
      type: "Person",
      timestamp: Date.now()
    });
  }

  for (const m of payload.memories ?? []) {
    provenance.push({
      id: `fs-memory-${m.id}`,
      source: "familysearch",
      type: "Memory",
      timestamp: Date.now()
    });
  }

  for (const r of payload.records ?? []) {
    provenance.push({
      id: `fs-record-${r.id}`,
      source: "familysearch",
      type: "Record",
      timestamp: Date.now()
    });
  }

  return provenance;
}
