// confidence-familysearch.js — 2026-06-22 — v1.0.0

export function scoreFamilySearchResult({ payload }) {
  if (!payload?.person) {
    return { provider: "familysearch", score: 0.0 };
  }

  const hasMemories = payload.memories?.length > 0;
  const hasRecords = payload.records?.length > 0;

  let score = 0.6; // base score for a person match

  if (hasMemories) score += 0.2;
  if (hasRecords) score += 0.2;

  return {
    provider: "familysearch",
    score: Math.min(score, 1.0)
  };
}
