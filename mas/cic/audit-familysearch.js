// audit-familysearch.js — 2026-06-22 — v1.0.0

export function auditFamilySearchIngestion({ source, payload, durationMs }) {
  return {
    source: "familysearch",
    timestamp: Date.now(),
    durationMs,
    hasPerson: !!payload?.person,
    memoryCount: payload?.memories?.length ?? 0,
    recordCount: payload?.records?.length ?? 0,
    status: payload?.person ? "SUCCESS" : "NO_MATCH",
    raw: {
      search: payload?.raw?.search?.status ?? null,
      person: payload?.raw?.person?.status ?? null
    }
  };
}
