// fs-temporal-extract.js — 2026-06-22 — v1.0.0

export function extractFamilySearchTemporal(fsPayload) {
  const events = [];
  const p = fsPayload.person;

  if (p?.display?.birthDate) {
    events.push({ type: "BIRTH", date: p.display.birthDate, source: "familysearch" });
  }

  if (p?.display?.deathDate) {
    events.push({ type: "DEATH", date: p.display.deathDate, source: "familysearch" });
  }

  for (const r of fsPayload.records ?? []) {
    if (!r.date) continue;
    events.push({
      type: r.type?.toUpperCase() || "RECORD",
      date: r.date,
      source: "familysearch",
      recordId: r.id
    });
  }

  return events;
}
