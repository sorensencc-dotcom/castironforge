// predictive-familysearch.js — 2026-06-22 — v1.0.0

export function predictFamilySearchPatterns({ temporal, spatial, payload }) {
  const predictions = [];

  // Lifespan prediction
  const birth = temporal.events.find(e => e.type === "BIRTH");
  const death = temporal.events.find(e => e.type === "DEATH");

  if (birth && !death) {
    predictions.push({
      type: "LIFESPAN_ESTIMATE",
      estimate: `${birth.date}–${parseInt(birth.date) + 70}`,
      reason: "Typical lifespan heuristic"
    });
  }

  // Migration likelihood
  const birthPlace = spatial.places.find(p => p.type === "BIRTH_PLACE");
  const recordPlaces = spatial.places.filter(p => p.type === "RECORD_PLACE");

  if (birthPlace && recordPlaces.length > 0) {
    const uniquePlaces = new Set(recordPlaces.map(r => r.place));
    if (uniquePlaces.size > 1) {
      predictions.push({
        type: "MIGRATION_LIKELY",
        reason: "Multiple distinct record locations detected"
      });
    }
  }

  // Record density prediction
  const recordCount = payload.records?.length ?? 0;
  predictions.push({
    type: "RECORD_DENSITY",
    estimate: recordCount > 5 ? "HIGH" : "LOW",
    reason: "Based on number of historical records"
  });

  return predictions;
}
