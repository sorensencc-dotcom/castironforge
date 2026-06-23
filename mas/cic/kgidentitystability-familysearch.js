// kgidentitystability-familysearch.js — 2026-06-22 — v1.0.0

export function computeFamilySearchIdentityStability({ previous, current, providers }) {
  const stability = {
    name: 0.5,
    birth: 0.5,
    death: 0.5,
    crossProvider: 0.5
  };

  // Name stability
  if (previous.name && current.name) {
    stability.name = previous.name === current.name ? 1.0 : 0.2;
  }

  // Birth stability
  if (previous.birth && current.birth) {
    stability.birth = previous.birth === current.birth ? 1.0 : 0.3;
  }

  // Death stability
  if (previous.death && current.death) {
    stability.death = previous.death === current.death ? 1.0 : 0.3;
  }

  // Cross‑provider stability
  let matches = 0;
  let total = 0;

  for (const provider of Object.keys(providers)) {
    const p = providers[provider];
    if (!p?.person) continue;

    total++;

    if (p.person.display?.name === current.name) matches++;
    if (p.person.display?.birthDate === current.birth) matches++;
    if (p.person.display?.deathDate === current.death) matches++;
  }

  stability.crossProvider = total > 0 ? matches / (total * 3) : 0.5;

  return stability;
}
