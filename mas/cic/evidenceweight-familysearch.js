// evidenceweight-familysearch.js — 2026-06-22 — v1.0.0

export function weightFamilySearchEvidence({ fsEvidence, providerStats }) {
  return fsEvidence.map(e => {
    const base =
      e.type === "RECORD" ? 0.7 :
      e.type === "MEMORY" ? 0.4 :
      0.5;

    const providerReliability =
      providerStats?.familysearch?.reliability ?? 0.5;

    const weight = base * providerReliability;

    return {
      ...e,
      weight: Math.min(1.0, Math.max(0, weight))
    };
  });
}
