// corpus-familysearch.js — 2026-06-22 — v1.0.0

export function storeFamilySearchCorpusEntry({ payload, write }) {
  const entry = {
    id: `fs-${payload.person?.id ?? Date.now()}`,
    source: "familysearch",
    timestamp: Date.now(),
    person: payload.person ?? null,
    memories: payload.memories ?? [],
    records: payload.records ?? [],
    raw: payload.raw
  };

  write(entry.id, entry);

  return entry.id;
}
