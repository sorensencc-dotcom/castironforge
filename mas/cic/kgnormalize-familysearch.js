// kgnormalize-familysearch.js — 2026-06-22 — v1.0.0

export function normalizeFamilySearchKG({ nodes }) {
  return nodes.map(n => {
    const normalized = { ...n };

    // Normalize names (Title Case)
    if (normalized.name) {
      normalized.name = normalized.name
        .split(" ")
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ");
    }

    // Normalize dates (YYYY-MM-DD)
    if (normalized.birth) {
      normalized.birth = normalized.birth.replace(/\/|\.| /g, "-");
    }
    if (normalized.death) {
      normalized.death = normalized.death.replace(/\/|\.| /g, "-");
    }

    // Normalize media types
    if (normalized.mediaType) {
      normalized.mediaType = normalized.mediaType.toLowerCase();
    }

    return normalized;
  });
}
