// ancestraltrajectory-familysearch.js — 2026-06-22 — v1.0.0

export function modelFamilySearchAncestralTrajectory({ lineage, spatial }) {
  const trajectory = [];

  for (const p of lineage) {
    const birthPlace = spatial.find(
      s => s.type === "BIRTH_PLACE" && s.personId === p.id
    );
    const deathPlace = spatial.find(
      s => s.type === "DEATH_PLACE" && s.personId === p.id
    );

    const birthYear = p.birth ? parseInt(p.birth) : null;
    const deathYear = p.death ? parseInt(p.death) : null;

    trajectory.push({
      id: p.id,
      name: p.name,
      lifespan: birthYear && deathYear ? deathYear - birthYear : null,
      migration:
        birthPlace && deathPlace && birthPlace.place !== deathPlace.place
          ? { from: birthPlace.place, to: deathPlace.place }
          : null
    });
  }

  return trajectory;
}
