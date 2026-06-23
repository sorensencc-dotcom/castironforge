// provenancemerge-familysearch.js — 2026-06-22 — v1.0.0

export function mergeFamilySearchProvenance({ fsProv, otherProv }) {
  const combined = [...(otherProv ?? []), ...(fsProv ?? [])];

  // Sort by timestamp
  combined.sort((a, b) => a.timestamp - b.timestamp);

  // Deduplicate by (id + source)
  const seen = new Set();
  const deduped = [];

  for (const p of combined) {
    const key = `${p.id}:${p.source}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(p);
    }
  }

  return deduped;
}
