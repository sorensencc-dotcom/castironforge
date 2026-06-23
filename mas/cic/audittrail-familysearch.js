// audittrail-familysearch.js — 2026-06-22 — v1.0.0

export function recordFamilySearchAuditEvent({ eventStore, action, payload }) {
  const entry = {
    id: `audit-fs-${Date.now()}`,
    timestamp: Date.now(),
    action,
    personId: payload?.person?.id ?? null,
    memoryCount: payload?.memories?.length ?? 0,
    recordCount: payload?.records?.length ?? 0,
    raw: payload?.raw ?? null
  };

  eventStore.write(entry.id, entry);
  return entry;
}
