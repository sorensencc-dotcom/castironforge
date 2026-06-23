// lineagearbitration-familysearch.js — 2026-06-22 — v1.0.0

export function arbitrateFamilySearchLineage({ fsLineage, providerLineages }) {
  const decisions = [];

  for (const provider of Object.keys(providerLineages)) {
    const other = providerLineages[provider];

    for (const fsPerson of fsLineage) {
      const match = other.find(p => p.id === fsPerson.id);
      if (!match) continue;

      // Parent arbitration
      const fsParents = new Set(fsPerson.parents ?? []);
      const otherParents = new Set(match.parents ?? []);

      const parentConflict =
        [...fsParents].some(p => !otherParents.has(p)) ||
        [...otherParents].some(p => !fsParents.has(p));

      if (parentConflict) {
        decisions.push({
          id: fsPerson.id,
          field: "parents",
          winner: "familysearch",
          fsValue: [...fsParents],
          otherValue: [...otherParents],
          comparedAgainst: provider
        });
      }

      // Children arbitration
      const fsChildren = new Set(fsPerson.children ?? []);
      const otherChildren = new Set(match.children ?? []);

      const childConflict =
        [...fsChildren].some(c => !otherChildren.has(c)) ||
        [...otherChildren].some(c => !fsChildren.has(c));

      if (childConflict) {
        decisions.push({
          id: fsPerson.id,
          field: "children",
          winner: "familysearch",
          fsValue: [...fsChildren],
          otherValue: [...otherChildren],
          comparedAgainst: provider
        });
      }
    }
  }

  return decisions;
}
