// evidence-familysearch.js — 2026-06-22 — v1.0.0

export function weightFamilySearchEvidence({ payload }) {
  const weights = [];

  if (payload.person) {
    weights.push({
      type: "PERSON_CORE",
      weight: 0.6,
      reason: "Primary person identity"
    });
  }

  for (const r of payload.records ?? []) {
    weights.push({
      type: "RECORD",
      weight: 0.2,
      recordId: r.id,
      reason: "Historical record evidence"
    });
  }

  for (const m of payload.memories ?? []) {
    weights.push({
      type: "MEMORY",
      weight: 0.1,
      memoryId: m.id,
      reason: "User-submitted memory evidence"
    });
  }

  return weights;
}
