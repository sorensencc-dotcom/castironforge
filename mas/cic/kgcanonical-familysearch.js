// kgcanonical-familysearch.js — 2026-06-22 — v1.0.0

export function canonicalizeFamilySearchKG({ nodes }) {
  return nodes.map(n => {
    const canonical = { ...n };

    // Canonical ID prefix
    canonical.id = `fs:${n.id}`;

    // Canonical name formatting
    if (canonical.name) {
      canonical.name = canonical.name
        .trim()
        .replace(/\s+/g, " ")
        .replace(/\b\w/g, c => c.toUpperCase());
    }

    // Canonical date formatting (YYYY-MM-DD)
    const normalizeDate = d =>
      d ? d.replace(/[^0-9]/g, "-").replace(/--+/g, "-") : null;

    canonical.birth = normalizeDate(canonical.birth);
    canonical.death = normalizeDate(canonical.death);

    return canonical;
  });
}
