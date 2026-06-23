// gendrift-familysearch.js — 2026-06-22 — v1.0.0

export function modelFamilySearchGenerationalDrift({ lineage }) {
  const drift = [];

  for (const p of lineage) {
    const birthYear = p.birth ? parseInt(p.birth) : null;
    const deathYear = p.death ? parseInt(p.death) : null;

    let lifespan = null;
    if (birthYear && deathYear) lifespan = deathYear - birthYear;

    drift.push({
      id: p.id,
      name: p.name,
      lifespanDrift:
        lifespan && lifespan > 70 ? "UPWARD" :
        lifespan && lifespan < 40 ? "DOWNWARD" :
        "STABLE",
      namingDrift:
        p.name?.split(" ")[0]?.length > 8 ? "LONGER_NAMES" : "NORMAL",
      recordDrift:
        (p.records?.length ?? 0) > 5 ? "HIGH_DENSITY" : "LOW_DENSITY"
    });
  }

  return drift;
}
