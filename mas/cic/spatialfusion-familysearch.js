// spatialfusion-familysearch.js — 2026-06-22 — v1.0.0

export function fuseFamilySearchSpatial({ fsSpatial, otherSpatial }) {
  const combined = [...(otherSpatial ?? []), ...(fsSpatial ?? [])];

  // Deduplicate by (place + type)
  const seen = new Set();
  const deduped = [];

  for (const loc of combined) {
    const key = `${loc.place}:${loc.type}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(loc);
    }
  }

  return deduped;
}
