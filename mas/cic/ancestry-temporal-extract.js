// ancestry-temporal-extract.js — 2026-06-23 — v1.0.0
// Extracts temporal events from Ancestry payload format

export function extractAncestryTemporal(ancestryPayload) {
  const events = [];
  const p = ancestryPayload.person;

  if (p?.display?.birthDate) {
    events.push({ type: "BIRTH", date: p.display.birthDate, source: "ancestry" });
  }

  if (p?.display?.deathDate) {
    events.push({ type: "DEATH", date: p.display.deathDate, source: "ancestry" });
  }

  for (const r of ancestryPayload.records ?? []) {
    if (!r.date) continue;
    events.push({
      type: r.type?.toUpperCase() || "RECORD",
      date: r.date,
      source: "ancestry",
      recordId: r.id
    });
  }

  return events;
}
