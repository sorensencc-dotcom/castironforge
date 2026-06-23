// kgtemporalnormalize-familysearch.js — 2026-06-22 — v1.0.0

export function normalizeFamilySearchTemporal({ events }) {
  const normalize = d => {
    if (!d) return null;
    const digits = d.replace(/[^0-9]/g, "");
    if (digits.length === 4) return `${digits}-01-01`;
    if (digits.length === 6) return `${digits.slice(0,4)}-${digits.slice(4,6)}-01`;
    if (digits.length === 8) return `${digits.slice(0,4)}-${digits.slice(4,6)}-${digits.slice(6,8)}`;
    return null;
  };

  return events.map(e => ({
    ...e,
    normalizedDate: normalize(e.date),
    precision:
      e.date?.length === 4 ? "YEAR" :
      e.date?.length === 7 ? "MONTH" :
      e.date?.length === 10 ? "DAY" :
      "UNKNOWN"
  }));
}
