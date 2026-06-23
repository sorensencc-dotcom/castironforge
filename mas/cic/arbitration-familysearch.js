// arbitration-familysearch.js — 2026-06-22 — v1.0.0

export function arbitrateFamilySearchFacts({ fs, others, reliability }) {
  const decisions = [];

  for (const providerKey of Object.keys(others)) {
    const other = others[providerKey];
    if (!other?.person) continue;

    const fsBirth = fs.person?.display?.birthDate;
    const otherBirth = other.person?.display?.birthDate;

    if (fsBirth && otherBirth) {
      const winner =
        reliability.reliability >= (other.reliability ?? 0.5)
          ? "familysearch"
          : providerKey;

      decisions.push({
        fact: "birthDate",
        winner,
        fsValue: fsBirth,
        otherValue: otherBirth,
        comparedAgainst: providerKey
      });
    }
  }

  return decisions;
}
