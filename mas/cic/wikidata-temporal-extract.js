// wikidata-temporal-extract.js — 2026-06-23 — v1.0.0
// Extracts temporal events from WikiData JSON-LD payload format

export function extractWikiDataTemporal(wikiDataPayload) {
  const events = [];
  const p = wikiDataPayload.person;

  // Extract birth date with WikiData precision mapping
  if (p?.birthDate) {
    const birthValue = p.birthDate.value || p.birthDate;
    if (birthValue) {
      events.push({
        type: "BIRTH",
        date: normalizeDateString(birthValue),
        source: "wikidata",
        wikiDataPrecision: p.birthDate.precision || 8
      });
    }
  }

  // Extract death date with WikiData precision mapping
  if (p?.deathDate) {
    const deathValue = p.deathDate.value || p.deathDate;
    if (deathValue) {
      events.push({
        type: "DEATH",
        date: normalizeDateString(deathValue),
        source: "wikidata",
        wikiDataPrecision: p.deathDate.precision || 8
      });
    }
  }

  // Extract events array if present
  for (const evt of wikiDataPayload.events ?? []) {
    if (!evt.date) continue;
    events.push({
      type: evt.type?.toUpperCase() || "RECORD",
      date: normalizeDateString(evt.date),
      source: "wikidata",
      recordId: evt.id
    });
  }

  return events;
}

// Normalize date strings to standard format (YYYY, YYYY-MM, or YYYY-MM-DD)
function normalizeDateString(dateStr) {
  if (!dateStr) return null;

  // If already in standard format, return as-is
  if (/^\d{4}(-\d{2}){0,2}$/.test(dateStr)) {
    return dateStr;
  }

  // Extract digits
  const digits = dateStr.replace(/[^0-9]/g, "");
  if (digits.length < 4) return null;

  // Return YYYY format (year only)
  if (digits.length === 4) return digits;

  // Return YYYY-MM format
  if (digits.length === 5 || digits.length === 6) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 6).padEnd(2, "0")}`;
  }

  // Return YYYY-MM-DD format
  if (digits.length >= 8) {
    const year = digits.slice(0, 4);
    const month = digits.slice(4, 6).padEnd(2, "0");
    const day = digits.slice(6, 8).padEnd(2, "0");
    return `${year}-${month}-${day}`;
  }

  return null;
}
