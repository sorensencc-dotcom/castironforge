// lifecycle-familysearch.js — 2026-06-22 — v1.0.0

export const FamilySearchLifecycle = {
  id: "familysearch",
  version: "1.0.0",

  shouldRefresh(entry) {
    // Refresh if older than 30 days
    const THIRTY_DAYS = 1000 * 60 * 60 * 24 * 30;
    return Date.now() - entry.timestamp > THIRTY_DAYS;
  },

  shouldPrune(entry) {
    // Prune if no person and no evidence
    const noPerson = !entry.person;
    const noEvidence =
      (entry.records?.length ?? 0) === 0 &&
      (entry.memories?.length ?? 0) === 0;

    return noPerson && noEvidence;
  },

  updateTimestamp(entry) {
    return { ...entry, timestamp: Date.now() };
  }
};
