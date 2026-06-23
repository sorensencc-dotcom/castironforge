// kgtemporalprecision-familysearch.js — 2026-06-22 — v1.0.0

export function enhanceFamilySearchTemporalPrecision({ events }) {
  return events.map(e => {
    if (e.precision === "DAY") return e;

    const normalized = e.normalizedDate;
    const year = normalized.slice(0, 4);

    if (e.precision === "YEAR") {
      return {
        ...e,
        normalizedDate: `${year}-06-15`,
        precision: "INFERRED_DAY"
      };
    }

    if (e.precision === "MONTH") {
      const month = normalized.slice(5, 7);
      return {
        ...e,
        normalizedDate: `${year}-${month}-15`,
        precision: "INFERRED_DAY"
      };
    }

    return e;
  });
}
