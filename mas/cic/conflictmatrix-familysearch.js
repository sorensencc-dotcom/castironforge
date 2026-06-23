// conflictmatrix-familysearch.js — 2026-06-22 — v1.0.0

export function buildFamilySearchConflictMatrix({ fs, others }) {
  const matrix = {};

  const fsBirth = fs.person?.display?.birthDate;
  const fsDeath = fs.person?.display?.deathDate;

  for (const provider of Object.keys(others)) {
    const other = others[provider];
    if (!other?.person) continue;

    const row = {};

    const otherBirth = other.person.display?.birthDate;
    const otherDeath = other.person.display?.deathDate;

    row.birthDate = fsBirth && otherBirth && fsBirth !== otherBirth;
    row.deathDate = fsDeath && otherDeath && fsDeath !== otherDeath;

    matrix[provider] = row;
  }

  return matrix;
}
