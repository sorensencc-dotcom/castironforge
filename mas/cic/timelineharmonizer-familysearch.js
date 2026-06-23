// timelineharmonizer-familysearch.js — 2026-06-22 — v1.0.0

export function harmonizeFamilySearchTimelines({ fsTimeline, otherTimelines }) {
  const combined = [...fsTimeline, ...(otherTimelines ?? [])];

  // Sort chronologically
  combined.sort((a, b) => (a.date > b.date ? 1 : -1));

  // Remove duplicates by (type + date + source)
  const seen = new Set();
  const deduped = [];

  for (const e of combined) {
    const key = `${e.type}:${e.date}:${e.source}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(e);
    }
  }

  return deduped;
}
