// generationalanomalies-familysearch.js — 2026-06-22 — v1.0.0

export function detectFamilySearchGenerationalAnomalies({ lineage }) {
  const anomalies = [];

  for (const p of lineage) {
    if (!p.birth || !p.parents) continue;

    const birthYear = parseInt(p.birth);

    for (const parentId of p.parents) {
      const parent = lineage.find(x => x.id === parentId);
      if (!parent?.birth) continue;

      const parentBirth = parseInt(parent.birth);
      const gap = birthYear - parentBirth;

      // Parent younger than child
      if (gap < 12) {
        anomalies.push({
          type: "PARENT_TOO_YOUNG",
          childId: p.id,
          parentId,
          gap
        });
      }

      // Parent implausibly old
      if (gap > 60) {
        anomalies.push({
          type: "PARENT_TOO_OLD",
          childId: p.id,
          parentId,
          gap
        });
      }
    }
  }

  return anomalies;
}
