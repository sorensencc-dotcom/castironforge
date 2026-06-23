// tq-familysearch.js — 2026-06-22 — v1.0.0

export function indexFamilySearchForTorque({ entry }) {
  const textParts = [];

  if (entry.person?.display?.name) textParts.push(entry.person.display.name);
  if (entry.person?.display?.birthDate) textParts.push(entry.person.display.birthDate);
  if (entry.person?.display?.deathDate) textParts.push(entry.person.display.deathDate);

  for (const m of entry.memories ?? []) {
    if (m.title) textParts.push(m.title);
    if (m.about) textParts.push(m.about);
  }

  for (const r of entry.records ?? []) {
    if (r.title) textParts.push(r.title);
    if (r.collection) textParts.push(r.collection);
  }

  return {
    id: entry.id,
    source: "familysearch",
    text: textParts.join(" "),
    metadata: {
      hasPerson: !!entry.person,
      memoryCount: entry.memories?.length ?? 0,
      recordCount: entry.records?.length ?? 0
    }
  };
}
