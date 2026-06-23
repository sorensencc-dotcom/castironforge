// semantic-familysearch.js — 2026-06-22 — v1.0.0

export function tagFamilySearchPayload({ payload }) {
  const tags = {
    people: [],
    places: [],
    dates: [],
    events: []
  };

  const p = payload.person;

  if (p?.display?.name) {
    tags.people.push(p.display.name);
  }

  if (p?.display?.birthDate) {
    tags.dates.push(p.display.birthDate);
    tags.events.push(`Birth:${p.display.birthDate}`);
  }

  if (p?.display?.deathDate) {
    tags.dates.push(p.display.deathDate);
    tags.events.push(`Death:${p.display.deathDate}`);
  }

  for (const r of payload.records ?? []) {
    if (r.title) tags.events.push(`Record:${r.title}`);
    if (r.collection) tags.places.push(r.collection);
  }

  for (const m of payload.memories ?? []) {
    if (m.title) tags.events.push(`Memory:${m.title}`);
  }

  return tags;
}
