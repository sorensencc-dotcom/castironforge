// genforecast-familysearch.js — 2026-06-22 — v1.0.0

export function forecastFamilySearchGenerations({ lineage }) {
  const forecasts = [];

  for (const p of lineage) {
    const birthYear = p.birth ? parseInt(p.birth) : null;
    const deathYear = p.death ? parseInt(p.death) : null;

    let lifespan = null;
    if (birthYear && deathYear) lifespan = deathYear - birthYear;

    forecasts.push({
      id: p.id,
      expectedDescendants:
        (p.children?.length ?? 0) > 0
          ? (p.children.length * 1.5)
          : 1,
      migrationLikelihood:
        p.birthPlace && p.deathPlace && p.birthPlace !== p.deathPlace
          ? 0.8
          : 0.2,
      lifespanTrend:
        lifespan
          ? (lifespan > 70 ? "LONG" : lifespan < 40 ? "SHORT" : "AVERAGE")
          : "UNKNOWN"
    });
  }

  return forecasts;
}
