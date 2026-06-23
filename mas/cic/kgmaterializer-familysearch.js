// kgmaterializer-familysearch.js — 2026-06-22 — v1.0.0

export function materializeFamilySearchKG({ nodes, edges }) {
  const materialized = {
    persons: [],
    artifacts: [],
    records: [],
    relations: []
  };

  for (const n of nodes) {
    if (n.type === "Person") materialized.persons.push(n);
    if (n.type === "Artifact") materialized.artifacts.push(n);
    if (n.type === "Record") materialized.records.push(n);
  }

  for (const e of edges) {
    materialized.relations.push({
      from: e.from,
      to: e.to,
      type: e.type
    });
  }

  return materialized;
}
