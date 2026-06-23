// ranking-familysearch.js — 2026-06-22 — v1.0.0

export function rankFamilySearchGlobally({ reliability, evidenceWeights, alignments }) {
  let score = reliability.reliability;

  // Add evidence contributions
  for (const w of evidenceWeights) {
    score += w.weight * 0.1;
  }

  // Add alignment boosts
  const matches = alignments.filter(a => a.match).length;
  score += matches * 0.05;

  return {
    provider: "familysearch",
    globalScore: Math.min(1.0, score)
  };
}
