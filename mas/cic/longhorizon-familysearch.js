// longhorizon-familysearch.js — 2026-06-22 — v1.0.0

export function familySearchLongHorizonReasoning({ temporal, spatial }) {
  const insights = [];

  // Multi‑decade lifespan
  const birth = temporal.events.find(e => e.type === "BIRTH");
  const death = temporal.events.find(e => e.type === "DEATH");

  if (birth && death) {
    const lifespan = parseInt(death.date) - parseInt(birth.date);
    insights.push(`Lifespan: approximately ${lifespan} years`);
  }

  // Migration detection
  const birthPlace = spatial.places.find(p => p.type === "BIRTH_PLACE");
  const deathPlace = spatial.places.find(p => p.type === "DEATH_PLACE");

  if (birthPlace && deathPlace && birthPlace.place !== deathPlace.place) {
    insights.push(
      `Detected migration from ${birthPlace.place} to ${deathPlace.place}`
    );
  }

  // Record‑based temporal anchors
  const recordEvents = temporal.events.filter(e => e.type === "RECORD");
  if (recordEvents.length > 0) {
    insights.push(`Historical records span ${recordEvents.length} known events`);
  }

  return insights;
}
