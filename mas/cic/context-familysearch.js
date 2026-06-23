// context-familysearch.js — 2026-06-22 — v1.0.0

export function buildFamilySearchAgentContext({ payload, ranking, reliability }) {
  return {
    familysearch: {
      person: payload.person ?? null,
      memories: payload.memories ?? [],
      records: payload.records ?? [],
      globalScore: ranking.globalScore,
      reliability: reliability.reliability
    }
  };
}
