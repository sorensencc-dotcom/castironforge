// kgshard-familysearch.js — 2026-06-22 — v1.0.0

export function shardFamilySearchKG({ materialized, shardCount = 8 }) {
  const hash = str =>
    [...str].reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) % shardCount, 0);

  const shards = Array.from({ length: shardCount }, () => ({
    persons: [],
    artifacts: [],
    records: [],
    relations: []
  }));

  for (const p of materialized.persons) {
    shards[hash(p.id)].persons.push(p);
  }

  for (const a of materialized.artifacts) {
    shards[hash(a.id)].artifacts.push(a);
  }

  for (const r of materialized.records) {
    shards[hash(r.id)].records.push(r);
  }

  for (const rel of materialized.relations) {
    shards[hash(rel.from)].relations.push(rel);
  }

  return shards;
}
