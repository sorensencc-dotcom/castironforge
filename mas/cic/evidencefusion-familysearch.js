// evidencefusion-familysearch.js — 2026-06-22 — v1.0.0

export function fuseFamilySearchEvidence({ fsEvidence, otherEvidence }) {
  const fused = [];

  for (const e of fsEvidence) {
    fused.push({
      provider: "familysearch",
      type: e.type,
      weight: e.weight,
      sourceId: e.recordId ?? e.memoryId ?? null
    });
  }

  for (const provider of Object.keys(otherEvidence)) {
    for (const e of otherEvidence[provider]) {
      fused.push({
        provider,
        type: e.type,
        weight: e.weight,
        sourceId: e.recordId ?? e.memoryId ?? null
      });
    }
  }

  // Sort by weight descending
  fused.sort((a, b) => b.weight - a.weight);

  return fused;
}
