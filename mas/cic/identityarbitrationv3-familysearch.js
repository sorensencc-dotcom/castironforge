// identityarbitrationv3-familysearch.js — 2026-06-22 — v1.0.0

export function arbitrateFamilySearchIdentityV3({ fs, providers, stats }) {
  const results = [];

  const fsName = fs.person?.display?.name?.toLowerCase();
  const fsBirth = fs.person?.display?.birthDate;
  const fsDeath = fs.person?.display?.deathDate;

  for (const provider of Object.keys(providers)) {
    const p = providers[provider];
    if (!p?.person) continue;

    const reliability = stats[provider]?.reliability ?? 0.5;

    const nameMatch =
      fsName && p.person.display?.name?.toLowerCase() === fsName ? 1 : 0;

    const birthMatch =
      fsBirth && p.person.display?.birthDate === fsBirth ? 1 : 0;

    const deathMatch =
      fsDeath && p.person.display?.deathDate === fsDeath ? 1 : 0;

    const score =
      (nameMatch * 0.5 + birthMatch * 0.3 + deathMatch * 0.2) *
      reliability;

    results.push({
      provider,
      score,
      aligned: score >= 0.65
    });
  }

  return results;
}
