// autoscheduler-familysearch.js — 2026-06-22 — v1.0.0

export const FamilySearchAutoscheduler = {
  id: "familysearch",
  version: "1.0.0",

  shouldSchedule({ query }) {
    if (!query) return false;

    // Heuristic: schedule if query looks like a person search
    const hasYear = /\b(17|18|19|20)\d{2}\b/.test(query);
    const hasName = /\b[A-Z][a-z]+\s[A-Z][a-z]+/.test(query);

    return hasName || hasYear;
  },

  nextRun() {
    // Deterministic: run immediately
    return Date.now();
  }
};
