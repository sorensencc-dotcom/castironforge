// reliability-familysearch.js — 2026-06-22 — v1.0.0

export function scoreFamilySearchReliability({ payload, conflicts }) {
  let score = 0.5; // base reliability

  if (payload.records?.length > 0) score += 0.2;
  if (payload.memories?.length > 0) score += 0.1;

  if (conflicts.length > 0) {
    score -= 0.2 * conflicts.length;
  }

  return {
    provider: "familysearch",
    reliability: Math.max(0, Math.min(score, 1.0)),
    conflictCount: conflicts.length
  };
}
