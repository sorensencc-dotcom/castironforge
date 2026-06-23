// temporalarbitrationv2-familysearch.js — 2026-06-22 — v1.0.0

export function arbitrateFamilySearchTemporalV2({ fsEvents, providerEvents, providerStats }) {
  const decisions = [];

  const fsBirth = fsEvents.find(e => e.type === "BIRTH");
  const fsDeath = fsEvents.find(e => e.type === "DEATH");

  // Check if FS data is internally consistent
  const fsConsistent = !fsBirth || !fsDeath || !fsBirth.normalizedDate || !fsDeath.normalizedDate ||
    (parseInt(fsDeath.normalizedDate) >= parseInt(fsBirth.normalizedDate));

  for (const provider of Object.keys(providerEvents)) {
    const events = providerEvents[provider];
    const reliability = providerStats[provider]?.reliability ?? 0.5;

    const otherBirth = events.find(e => e.type === "BIRTH");
    const otherDeath = events.find(e => e.type === "DEATH");

    if (fsBirth && otherBirth) {
      // FS gets baseline score, but penalized if inconsistent
      const fsScore = fsConsistent ? 1.0 : 0.3;
      const otherScore = reliability * (otherBirth.precision === "DAY" ? 1.0 : 0.7);

      decisions.push({
        field: "birthDate",
        winner: fsScore >= otherScore ? "familysearch" : provider,
        fsValue: fsBirth.normalizedDate,
        otherValue: otherBirth.normalizedDate,
        comparedAgainst: provider
      });
    }

    if (fsDeath && otherDeath) {
      let fsScore = fsConsistent ? 1.0 : 0.3;
      const otherScore = reliability * (otherDeath.precision === "DAY" ? 1.0 : 0.7);

      decisions.push({
        field: "deathDate",
        winner: fsScore >= otherScore ? "familysearch" : provider,
        fsValue: fsDeath.normalizedDate,
        otherValue: otherDeath.normalizedDate,
        comparedAgainst: provider
      });
    }
  }

  return { decisions };
}
