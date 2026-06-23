// consensus-familysearch.js — 2026-06-22 — v1.0.0

export function computeFamilySearchConsensus({ fs, others }) {
  const consensus = {};

  const providers = ["familysearch", ...Object.keys(others)];

  // Consensus for birth date
  const birthDates = providers
    .map(p => ({
      provider: p,
      value: p === "familysearch"
        ? fs.person?.display?.birthDate
        : others[p]?.person?.display?.birthDate
    }))
    .filter(x => x.value);

  const grouped = birthDates.reduce((acc, b) => {
    acc[b.value] = acc[b.value] || [];
    acc[b.value].push(b.provider);
    return acc;
  }, {});

  const best = Object.entries(grouped).sort(
    (a, b) => b[1].length - a[1].length
  )[0];

  if (best) {
    consensus.birthDate = {
      value: best[0],
      supportingProviders: best[1]
    };
  }

  return consensus;
}
