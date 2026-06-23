// alignmentengine-familysearch.js — 2026-06-22 — v1.0.0

export function alignFamilySearchWithProviders({ fs, others }) {
  const alignments = [];

  const fsName = fs.person?.display?.name?.toLowerCase();
  const fsBirth = fs.person?.display?.birthDate;

  for (const provider of Object.keys(others)) {
    const other = others[provider];
    if (!other?.person) continue;

    const oName = other.person.display?.name?.toLowerCase();
    const oBirth = other.person.display?.birthDate;

    const nameScore = fsName && oName && fsName === oName ? 1 : 0;
    const birthScore = fsBirth && oBirth && fsBirth === oBirth ? 1 : 0;

    const alignmentScore = (nameScore * 0.6) + (birthScore * 0.4);

    alignments.push({
      provider,
      alignmentScore,
      aligned: alignmentScore >= 0.75
    });
  }

  return alignments;
}
