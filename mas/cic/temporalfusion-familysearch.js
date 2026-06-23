// temporalfusion-familysearch.js — 2026-06-22 — v1.0.0

export function fuseFamilySearchTemporal({ fsEvents, providerEvents }) {
  const fused = [...fsEvents];

  for (const provider of Object.keys(providerEvents)) {
    for (const e of providerEvents[provider]) {
      fused.push({
        ...e,
        provider
      });
    }
  }

  // Sort by normalized date
  fused.sort((a, b) => (a.normalizedDate > b.normalizedDate ? 1 : -1));

  // Deduplicate by (type + normalizedDate)
  const seen = new Set();
  const result = [];

  for (const e of fused) {
    const key = `${e.type}:${e.normalizedDate}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(e);
    }
  }

  return result;
}
