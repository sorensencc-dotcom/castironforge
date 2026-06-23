// insights-familysearch.js — 2026-06-22 — v1.0.0

export function generateFamilySearchInsights({ payload, conflicts, ranking }) {
  const insights = [];

  if (payload.person) {
    insights.push(`Primary individual: ${payload.person.display?.name}`);
  }

  if (payload.records?.length > 0) {
    insights.push(`Historical records available: ${payload.records.length}`);
  }

  if (payload.memories?.length > 0) {
    insights.push(`User-submitted memories: ${payload.memories.length}`);
  }

  if (conflicts.length > 0) {
    insights.push(`Detected ${conflicts.length} conflict(s) requiring review.`);
  }

  insights.push(`Global ranking score: ${ranking.globalScore}`);

  return insights;
}
