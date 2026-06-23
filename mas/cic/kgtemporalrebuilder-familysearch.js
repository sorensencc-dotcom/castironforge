// kgtemporalrebuilder-familysearch.js — 2026-06-22 — v1.0.0

export function rebuildFamilySearchTemporalKG({ payload }) {
  const events = [];

  const p = payload.person;

  if (p?.display?.birthDate) {
    events.push({
      type: "BIRTH",
      date: p.display.birthDate,
      source: "familysearch"
    });
  }

  if (p?.display?.deathDate) {
    events.push({
      type: "DEATH",
      date: p.display.deathDate,
      source: "familysearch"
    });
  }

  for (const r of payload.records ?? []) {
    if (r.date) {
      events.push({
        type: "RECORD",
        date: r.date,
        source: "familysearch",
        recordId: r.id
      });
    }
  }

  return events.sort((a, b) => (a.date > b.date ? 1 : -1));
}
