// kgtemporalrebuilder-familysearch.js — 2026-06-22 — v1.0.0

export function rebuildFamilySearchKGTemporal({ lineage, records }) {
  const timeline = [];

  // Births
  for (const p of lineage) {
    if (p.birth) {
      timeline.push({
        date: p.birth,
        type: "BIRTH",
        personId: p.id,
        source: "familysearch"
      });
    }
  }

  // Deaths
  for (const p of lineage) {
    if (p.death) {
      timeline.push({
        date: p.death,
        type: "DEATH",
        personId: p.id,
        source: "familysearch"
      });
    }
  }

  // Records
  for (const r of records) {
    if (r.date) {
      timeline.push({
        date: r.date,
        type: "RECORD",
        recordId: r.id,
        title: r.title,
        source: "familysearch"
      });
    }
  }

  // Sort chronologically
  timeline.sort((a, b) => (a.date > b.date ? 1 : -1));

  return timeline;
}
