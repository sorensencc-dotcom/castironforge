// alignment-familysearch.js — 2026-06-22 — v1.0.0

export function alignFamilySearchWithProviders({ fs, others }) {
  const alignments = [];

  for (const providerKey of Object.keys(others)) {
    const entry = others[providerKey];

    if (!entry.person) continue;

    const sameName =
      entry.person.display?.name === fs.person?.display?.name;

    const sameBirth =
      entry.person.display?.birthDate === fs.person?.display?.birthDate;

    if (sameName && sameBirth) {
      alignments.push({
        provider: providerKey,
        match: true,
        reason: "Name and birth date match"
      });
    } else {
      alignments.push({
        provider: providerKey,
        match: false,
        reason: "Insufficient overlap"
      });
    }
  }

  return alignments;
}
