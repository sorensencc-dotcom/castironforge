// spatialconsensus-familysearch.js — 2026-06-22 — v1.0.0

export function computeFamilySearchSpatialConsensus({ fsSpatial, providerSpatial }) {
  const votes = new Map();

  function vote(place, weight) {
    if (!place) return;
    votes.set(place, (votes.get(place) ?? 0) + weight);
  }

  // FS votes always count as 1.0
  for (const s of fsSpatial) vote(s.place, 1.0);

  // Other providers weighted by reliability
  for (const provider of Object.keys(providerSpatial)) {
    const entries = providerSpatial[provider].entries ?? providerSpatial[provider];
    const reliability = providerSpatial[provider].reliability ?? 0.5;

    for (const s of entries) vote(s.place, reliability);
  }

  // Pick highest‑scoring place
  let best = null;
  let bestScore = -Infinity;

  for (const [place, score] of votes.entries()) {
    if (score > bestScore) {
      best = place;
      bestScore = score;
    }
  }

  return {
    consensusPlace: best,
    score: bestScore,
    allVotes: [...votes.entries()]
  };
}
