// providerdrift-familysearch.js — 2026-06-22 — v1.0.0

export function detectFamilySearchProviderDrift({ fs, others }) {
  const drift = [];

  for (const providerKey of Object.keys(others)) {
    const other = others[providerKey];
    if (!other?.person) continue;

    const fsBirth = fs.person?.display?.birthDate;
    const otherBirth = other.person?.display?.birthDate;

    if (fsBirth && otherBirth && fsBirth !== otherBirth) {
      drift.push({
        provider: providerKey,
        field: "birthDate",
        fsValue: fsBirth,
        otherValue: otherBirth
      });
    }
  }

  return drift;
}
