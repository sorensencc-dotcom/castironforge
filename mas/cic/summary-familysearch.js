// summary-familysearch.js — 2026-06-22 — v1.0.0

export function summarizeFamilySearchPayload({ payload }) {
  const p = payload.person;
  if (!p) return "No FamilySearch person found.";

  const lines = [];

  lines.push(`Name: ${p.display?.name ?? "Unknown"}`);

  if (p.display?.birthDate) {
    lines.push(`Born: ${p.display.birthDate}`);
  }

  if (p.display?.deathDate) {
    lines.push(`Died: ${p.display.deathDate}`);
  }

  if (payload.records?.length > 0) {
    lines.push(`Records: ${payload.records.length} historical records found.`);
  }

  if (payload.memories?.length > 0) {
    lines.push(`Memories: ${payload.memories.length} artifacts or stories found.`);
  }

  return lines.join(" ");
}
