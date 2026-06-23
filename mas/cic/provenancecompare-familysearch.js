// provenancecompare-familysearch.js — 2026-06-22 — v1.0.0

export function compareFamilySearchProvenance({ fsProv, otherProv }) {
  const comparison = [];

  for (const provider of Object.keys(otherProv)) {
    const other = otherProv[provider];

    const fsIds = new Set(fsProv.map(p => p.id));
    const otherIds = new Set(other.map(p => p.id));

    const missingInFS = [...otherIds].filter(id => !fsIds.has(id));
    const missingInOther = [...fsIds].filter(id => !otherIds.has(id));

    comparison.push({
      provider,
      missingInFS,
      missingInOther,
      overlap: [...fsIds].filter(id => otherIds.has(id))
    });
  }

  return comparison;
}
