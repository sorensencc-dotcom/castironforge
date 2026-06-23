// predictivemigration-familysearch.js — 2026-06-22 — v1.0.0

export function predictFamilySearchMigration({ lineage, spatial }) {
  const predictions = [];

  for (const p of lineage) {
    const birthPlace = spatial.find(
      s => s.type === "BIRTH_PLACE" && s.personId === p.id
    );
    const deathPlace = spatial.find(
      s => s.type === "DEATH_PLACE" && s.personId === p.id
    );

    let likelihood = 0.2;

    if (birthPlace && deathPlace && birthPlace.place !== deathPlace.place) {
      likelihood = 0.9;
    } else if (p.records?.length > 5) {
      likelihood = 0.6;
    }

    predictions.push({
      id: p.id,
      name: p.name,
      migrationLikelihood: likelihood,
      probableRoute:
        likelihood > 0.5 && birthPlace && deathPlace
          ? { from: birthPlace.place, to: deathPlace.place }
          : null
    });
  }

  return predictions;
}
