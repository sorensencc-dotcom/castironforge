// conflict-familysearch.js — 2026-06-22 — v1.0.0

export function detectFamilySearchConflicts({ temporal, spatial }) {
  const conflicts = [];

  // Temporal: birth after death
  const birth = temporal.events.find(e => e.type === "BIRTH");
  const death = temporal.events.find(e => e.type === "DEATH");

  if (birth && death && birth.date > death.date) {
    conflicts.push({
      type: "TEMPORAL_CONFLICT",
      message: "Birth date occurs after death date",
      birth: birth.date,
      death: death.date
    });
  }

  // Spatial: impossible migration (same day, far distance)
  const birthPlace = spatial.places.find(p => p.type === "BIRTH_PLACE");
  const deathPlace = spatial.places.find(p => p.type === "DEATH_PLACE");

  if (birthPlace && deathPlace && birthPlace.place === deathPlace.place) {
    // No conflict — same place
  } else if (birthPlace && deathPlace) {
    conflicts.push({
      type: "SPATIAL_CONFLICT",
      message: "Birth and death places differ significantly",
      birthPlace: birthPlace.place,
      deathPlace: deathPlace.place
    });
  }

  return conflicts;
}
