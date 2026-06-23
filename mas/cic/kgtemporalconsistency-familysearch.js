// kgtemporalconsistency-familysearch.js — 2026-06-22 — v1.0.0

export function checkFamilySearchTemporalConsistency({ events }) {
  const issues = [];

  const birth = events.find(e => e.type === "BIRTH");
  const death = events.find(e => e.type === "DEATH");

  if (birth && death) {
    const b = parseInt(birth.normalizedDate.slice(0, 4));
    const d = parseInt(death.normalizedDate.slice(0, 4));

    if (d < b) {
      issues.push({
        type: "REVERSED_LIFESPAN",
        birth: birth.normalizedDate,
        death: death.normalizedDate
      });
    }
  }

  return { issues };
}
