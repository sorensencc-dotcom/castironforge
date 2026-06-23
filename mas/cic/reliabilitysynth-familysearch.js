// reliabilitysynth-familysearch.js — 2026-06-22 — v1.0.0

export function synthesizeFamilySearchReliability({ fs, others }) {
  let score = 0.5; // base reliability

  // Agreement with other providers
  let agreements = 0;
  let comparisons = 0;

  for (const provider of Object.keys(others)) {
    const other = others[provider];
    if (!other?.person) continue;

    comparisons++;

    if (
      fs.person?.display?.birthDate &&
      other.person.display?.birthDate &&
      fs.person.display.birthDate === other.person.display.birthDate
    ) {
      agreements++;
    }
  }

  if (comparisons > 0) {
    score += (agreements / comparisons) * 0.3;
  }

  // Completeness bonus
  const completeness =
    (fs.records?.length ?? 0) > 3 || (fs.memories?.length ?? 0) > 3
      ? 0.2
      : 0.05;

  score += completeness;

  return Math.min(1.0, score);
}
