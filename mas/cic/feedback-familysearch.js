// feedback-familysearch.js — 2026-06-22 — v1.0.0

export function updateFamilySearchFeedback({ feedbackStore, payload, score }) {
  const key = `fs:${payload.person?.id ?? "unknown"}`;

  const entry = {
    timestamp: Date.now(),
    score,
    hasPerson: !!payload.person,
    memoryCount: payload.memories?.length ?? 0,
    recordCount: payload.records?.length ?? 0
  };

  feedbackStore.write(key, entry);

  return entry;
}
