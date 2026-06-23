// tempspacialcorr-familysearch.js — 2026-06-22 — v1.0.0

export function correlateFamilySearchTemporalSpatial({ temporal, spatial }) {
  const correlations = [];

  const birth = temporal.find(e => e.type === "BIRTH");
  const death = temporal.find(e => e.type === "DEATH");

  const birthPlace = spatial.find(p => p.type === "BIRTH_PLACE");
  const deathPlace = spatial.find(p => p.type === "DEATH_PLACE");

  if (birth && birthPlace) {
    correlations.push({
      type: "BIRTH_EVENT_LOCATION",
      date: birth.date,
      place: birthPlace.place
    });
  }

  if (death && deathPlace) {
    correlations.push({
      type: "DEATH_EVENT_LOCATION",
      date: death.date,
      place: deathPlace.place
    });
  }

  // Migration detection
  if (birthPlace && deathPlace && birthPlace.place !== deathPlace.place) {
    correlations.push({
      type: "MIGRATION",
      from: birthPlace.place,
      to: deathPlace.place
    });
  }

  return correlations;
}
