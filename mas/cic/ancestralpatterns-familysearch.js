// ancestralpatterns-familysearch.js — 2026-06-22 — v1.0.0

export function synthesizeFamilySearchAncestralPatterns({ lineage }) {
  const patterns = {
    averageLifespan: null,
    migrationChains: [],
    namingPatterns: [],
    recordDensity: 0
  };

  // Lifespan
  const lifespans = lineage
    .map(p => {
      if (p.birth && p.death) {
        return parseInt(p.death) - parseInt(p.birth);
      }
      return null;
    })
    .filter(x => x !== null);

  if (lifespans.length > 0) {
    patterns.averageLifespan = Math.round(
      lifespans.reduce((a, b) => a + b, 0) / lifespans.length
    );
  }

  // Migration chains
  for (const p of lineage) {
    if (p.birthPlace && p.deathPlace && p.birthPlace !== p.deathPlace) {
      patterns.migrationChains.push({
        from: p.birthPlace,
        to: p.deathPlace
      });
    }
  }

  // Naming patterns
  const names = lineage.map(p => p.name);
  const firstNames = names.map(n => n.split(" ")[0]);
  const nameCounts = firstNames.reduce((acc, n) => {
    acc[n] = (acc[n] || 0) + 1;
    return acc;
  }, {});
  patterns.namingPatterns = Object.entries(nameCounts)
    .filter(([_, count]) => count > 1)
    .map(([name]) => name);

  // Record density
  patterns.recordDensity = lineage.reduce(
    (acc, p) => acc + (p.records?.length ?? 0),
    0
  );

  return patterns;
}
