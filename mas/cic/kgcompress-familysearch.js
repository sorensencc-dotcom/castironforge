// kgcompress-familysearch.js — 2026-06-22 — v1.0.0

export function compressFamilySearchKG({ materialized }) {
  return {
    persons: materialized.persons.map(p => ({
      id: p.id,
      n: p.name,
      b: p.birth,
      d: p.death
    })),
    artifacts: materialized.artifacts.map(a => ({
      id: a.id,
      t: a.title,
      m: a.mediaType
    })),
    records: materialized.records.map(r => ({
      id: r.id,
      t: r.title,
      c: r.collection
    })),
    relations: materialized.relations.map(r => ({
      f: r.from,
      t: r.to,
      y: r.type
    }))
  };
}
