// ancestralstability-familysearch.js — 2026-06-22 — v1.0.0

export function computeFamilySearchAncestralStability({ fs, others }) {
  const stability = {
    birth: 0.5,
    death: 0.5,
    places: 0.5,
    relationships: 0.5
  };

  let comparisons = 0;
  let birthAgree = 0;
  let deathAgree = 0;
  let placeAgree = 0;

  const fsBirth = fs.person?.display?.birthDate;
  const fsDeath = fs.person?.display?.deathDate;
  const fsBirthPlace = fs.person?.display?.birthPlace;
  const fsDeathPlace = fs.person?.display?.deathPlace;

  for (const provider of Object.keys(others)) {
    const o = others[provider];
    if (!o?.person) continue;

    comparisons++;

    if (o.person.display?.birthDate === fsBirth) birthAgree++;
    if (o.person.display?.deathDate === fsDeath) deathAgree++;
    if (o.person.display?.birthPlace === fsBirthPlace) placeAgree++;
    if (o.person.display?.deathPlace === fsDeathPlace) placeAgree++;
  }

  if (comparisons > 0) {
    stability.birth = birthAgree / comparisons;
    stability.death = deathAgree / comparisons;
    stability.places = placeAgree / (comparisons * 2);
  }

  // Relationship stability: proxy = number of matching parent IDs
  const fsParents = new Set(fs.parents ?? []);
  let relMatches = 0;
  let relTotal = 0;

  for (const provider of Object.keys(others)) {
    const o = others[provider];
    if (!o?.parents) continue;

    relTotal++;
    const oParents = new Set(o.parents);
    for (const p of fsParents) {
      if (oParents.has(p)) relMatches++;
    }
  }

  stability.relationships =
    relTotal > 0 ? relMatches / (relTotal * fsParents.size || 1) : 0.5;

  return stability;
}
