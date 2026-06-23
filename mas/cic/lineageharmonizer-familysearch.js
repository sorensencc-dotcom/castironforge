// lineageharmonizer-familysearch.js — 2026-06-22 — v1.0.0

export function harmonizeFamilySearchLineage({ fsLineage, otherLineages }) {
  const unified = {};

  // Seed with FS lineage
  for (const p of fsLineage) {
    unified[p.id] = {
      id: p.id,
      name: p.name,
      birth: p.birth,
      death: p.death,
      parents: new Set(p.parents ?? []),
      children: new Set(p.children ?? [])
    };
  }

  // Merge other providers
  for (const provider of Object.keys(otherLineages)) {
    for (const p of otherLineages[provider]) {
      if (!unified[p.id]) {
        unified[p.id] = {
          id: p.id,
          name: p.name,
          birth: p.birth,
          death: p.death,
          parents: new Set(),
          children: new Set()
        };
      }

      for (const parent of p.parents ?? []) unified[p.id].parents.add(parent);
      for (const child of p.children ?? []) unified[p.id].children.add(child);
    }
  }

  // Convert sets → arrays
  for (const id of Object.keys(unified)) {
    unified[id].parents = [...unified[id].parents];
    unified[id].children = [...unified[id].children];
  }

  return unified;
}
