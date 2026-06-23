// spatialarbitration-familysearch.js — 2026-06-22 — v1.0.0

export function arbitrateFamilySearchSpatial({ fsSpatial, providerSpatial }) {
  const decisions = [];

  const fsBirth = fsSpatial.find(s => s.type === "BIRTH_PLACE");
  const fsDeath = fsSpatial.find(s => s.type === "DEATH_PLACE");

  for (const provider of Object.keys(providerSpatial)) {
    const other = providerSpatial[provider];

    const otherBirth = other.find(s => s.type === "BIRTH_PLACE");
    const otherDeath = other.find(s => s.type === "DEATH_PLACE");

    if (fsBirth && otherBirth) {
      decisions.push({
        field: "birthPlace",
        winner:
          fsBirth.place === otherBirth.place
            ? "AGREEMENT"
            : "familysearch",
        fsValue: fsBirth.place,
        otherValue: otherBirth.place,
        comparedAgainst: provider
      });
    }

    if (fsDeath && otherDeath) {
      decisions.push({
        field: "deathPlace",
        winner:
          fsDeath.place === otherDeath.place
            ? "AGREEMENT"
            : "familysearch",
        fsValue: fsDeath.place,
        otherValue: otherDeath.place,
        comparedAgainst: provider
      });
    }
  }

  return decisions;
}
