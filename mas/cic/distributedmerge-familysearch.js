// distributedmerge-familysearch.js — 2026-06-22 — v1.0.0

export function mergeFamilySearchDistributed({ fsShards, otherShards }) {
  const merged = [];

  for (let i = 0; i < fsShards.length; i++) {
    const fs = fsShards[i];
    const other = otherShards[i] ?? {
      persons: [],
      artifacts: [],
      records: [],
      relations: []
    };

    merged.push({
      persons: [...other.persons, ...fs.persons],
      artifacts: [...other.artifacts, ...fs.artifacts],
      records: [...other.records, ...fs.records],
      relations: [...other.relations, ...fs.relations]
    });
  }

  return merged;
}
