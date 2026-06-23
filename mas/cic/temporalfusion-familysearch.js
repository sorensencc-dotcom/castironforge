// temporalfusion-familysearch.js — 2026-06-22 — v1.0.0

export function fuseFamilySearchTemporal({ fsTemporal, otherTemporal }) {
  const combined = [...(otherTemporal ?? []), ...(fsTemporal.events ?? [])];

  // Sort chronologically
  combined.sort((a, b) => (a.date > b.date ? 1 : -1));

  // Remove duplicates by (type + date)
  const seen = new Set();
  const deduped = [];

  for (const e of combined) {
    const key = `${e.type}:${e.date}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(e);
    }
  }

  return deduped;
}
