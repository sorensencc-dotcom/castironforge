// geninfluence-familysearch.js — 2026-06-22 — v1.0.0

export function modelFamilySearchGenerationalInfluence({ lineage }) {
  const influence = [];

  for (const p of lineage) {
    const children = p.children ?? [];
    const childCount = children.length;

    influence.push({
      id: p.id,
      name: p.name,
      descendantImpact: childCount * 1.2,
      migrationImpact:
        p.birthPlace && p.deathPlace && p.birthPlace !== p.deathPlace
          ? 0.8
          : 0.2,
      namingImpact:
        p.name?.split(" ")[0] ?? null,
      recordImpact: (p.records?.length ?? 0) * 0.5
    });
  }

  return influence;
}
