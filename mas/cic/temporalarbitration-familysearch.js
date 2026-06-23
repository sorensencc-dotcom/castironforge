// temporalarbitration-familysearch.js — 2026-06-22 — v1.0.0

export function arbitrateFamilySearchTemporal({ fsTemporal, otherTemporal }) {
  const decisions = [];

  const fsBirth = fsTemporal.events.find(e => e.type === "BIRTH");
  const fsDeath = fsTemporal.events.find(e => e.type === "DEATH");

  for (const provider of Object.keys(otherTemporal)) {
    const other = otherTemporal[provider];

    const otherBirth = other.events.find(e => e.type === "BIRTH");
    const otherDeath = other.events.find(e => e.type === "DEATH");

    // Birth arbitration
    if (fsBirth && otherBirth) {
      const winner =
        fsBirth.date <= otherBirth.date ? "familysearch" : provider;

      decisions.push({
        field: "birthDate",
        winner,
        fsValue: fsBirth.date,
        otherValue: otherBirth.date,
        comparedAgainst: provider
      });
    }

    // Death arbitration
    if (fsDeath && otherDeath) {
      const winner =
        fsDeath.date >= otherDeath.date ? "familysearch" : provider;

      decisions.push({
        field: "deathDate",
        winner,
        fsValue: fsDeath.date,
        otherValue: otherDeath.date,
        comparedAgainst: provider
      });
    }
  }

  return decisions;
}
