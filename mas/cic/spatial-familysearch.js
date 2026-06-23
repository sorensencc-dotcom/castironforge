// spatial-familysearch.js — 2026-06-22 — v1.0.0

export function buildFamilySearchSpatialModel({ payload }) {
  const places = [];

  const p = payload.person;

  if (p?.display?.birthPlace) {
    places.push({
      type: "BIRTH_PLACE",
      place: p.display.birthPlace,
      personId: p.id
    });
  }

  if (p?.display?.deathPlace) {
    places.push({
      type: "DEATH_PLACE",
      place: p.display.deathPlace,
      personId: p.id
    });
  }

  for (const r of payload.records ?? []) {
    if (r.place) {
      places.push({
        type: "RECORD_PLACE",
        place: r.place,
        recordId: r.id
      });
    }
  }

  return {
    personId: p?.id ?? null,
    places
  };
}
