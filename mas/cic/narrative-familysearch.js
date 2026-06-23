// narrative-familysearch.js — 2026-06-22 — v1.0.0

export function synthesizeFamilySearchNarrative({ temporal, spatial, payload }) {
  const p = payload.person;
  if (!p) return "";

  const birth = p.display?.birthDate ?? null;
  const birthPlace = p.display?.birthPlace ?? null;
  const death = p.display?.deathDate ?? null;
  const deathPlace = p.display?.deathPlace ?? null;

  const lines = [];

  if (birth) {
    lines.push(`${p.display.name} was born in ${birthPlace ?? "an unknown location"} on ${birth}.`);
  }

  for (const r of payload.records ?? []) {
    if (r.title) {
      lines.push(`A record titled "${r.title}" provides additional evidence about their life.`);
    }
  }

  if (death) {
    lines.push(`${p.display.name} died in ${deathPlace ?? "an unknown location"} on ${death}.`);
  }

  return lines.join(" ");
}
