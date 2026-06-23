// kgrehydrate-familysearch.js — 2026-06-22 — v1.0.0

export function rehydrateFamilySearchKG({ compressed }) {
  return {
    persons: compressed.persons.map(p => ({
      id: p.id,
      name: p.n,
      birth: p.b,
      death: p.d
    })),
    artifacts: compressed.artifacts.map(a => ({
      id: a.id,
      title: a.t,
      mediaType: a.m
    })),
    records: compressed.records.map(r => ({
      id: r.id,
      title: r.t,
      collection: r.c
    })),
    relations: compressed.relations.map(r => ({
      from: r.f,
      to: r.t,
      type: r.y
    }))
  };
}
