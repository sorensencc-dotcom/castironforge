// identityresolver-familysearch.js — 2026-06-22 — v1.0.0

export function resolveFamilySearchIdentity({ fs, others }) {
  const matches = [];

  for (const provider of Object.keys(others)) {
    const other = others[provider];
    if (!other?.person) continue;

    const sameName =
      fs.person?.display?.name &&
      other.person.display?.name &&
      fs.person.display.name.toLowerCase() ===
        other.person.display.name.toLowerCase();

    const sameBirth =
      fs.person?.display?.birthDate &&
      other.person.display?.birthDate &&
      fs.person.display.birthDate === other.person.display.birthDate;

    const confidence =
      (sameName ? 0.6 : 0) +
      (sameBirth ? 0.4 : 0);

    matches.push({
      provider,
      confidence,
      isSame: confidence >= 0.75
    });
  }

  return matches;
}
