// orchestrator-familysearch.js — 2026-06-22 — v1.0.0

export const FamilySearchRoutingRule = {
  id: "familysearch",
  version: "1.0.0",

  shouldRun({ query, context }) {
    if (!query) return false;

    // Deterministic heuristics:
    const looksLikePerson = /\b[A-Z][a-z]+\s[A-Z][a-z]+/.test(query);
    const hasYear = /\b(17|18|19|20)\d{2}\b/.test(query);

    return looksLikePerson || hasYear;
  },

  priority() {
    // FamilySearch runs after local providers but before heavy external ones
    return 50;
  }
};
