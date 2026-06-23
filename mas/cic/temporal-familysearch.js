// temporal-familysearch.js — 2026-06-22 — v1.0.0

export function buildFamilySearchTemporalModel({ payload }) {
  const events = [];

  const p = payload.person;

  if (p?.display?.birthDate) {
    events.push({
      type: "BIRTH",
      date: p.display.birthDate,
      personId: p.id
    });
  }

  if (p?.display?.deathDate) {
    events.push({
      type: "DEATH",
      date: p.display.deathDate,
      personId: p.id
    });
  }

  for (const r of payload.records ?? []) {
    if (r.date) {
      events.push({
        type: "RECORD",
        date: r.date,
        recordId: r.id
      });
    }
  }

  return {
    personId: p?.id ?? null,
    events: events.sort((a, b) => (a.date > b.date ? 1 : -1))
  };
}
