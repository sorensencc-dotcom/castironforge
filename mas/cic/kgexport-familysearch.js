// kgexport-familysearch.js — 2026-06-22 — v1.0.0

export function exportFamilySearchKG({ materialized }) {
  return {
    jsonld: {
      "@context": "https://schema.org",
      persons: materialized.persons.map(p => ({
        "@type": "Person",
        "@id": p.id,
        name: p.name,
        birthDate: p.birth,
        deathDate: p.death
      })),
      artifacts: materialized.artifacts.map(a => ({
        "@type": "CreativeWork",
        "@id": a.id,
        name: a.title,
        encodingFormat: a.mediaType
      })),
      records: materialized.records.map(r => ({
        "@type": "ArchiveComponent",
        "@id": r.id,
        name: r.title,
        collection: r.collection
      })),
      relations: materialized.relations
    }
  };
}
