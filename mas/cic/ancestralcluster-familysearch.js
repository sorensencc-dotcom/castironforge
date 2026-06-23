// ancestralcluster-familysearch.js — 2026-06-22 — v1.0.0

export function clusterFamilySearchAncestors({ lineage }) {
  const clusters = new Map();

  for (const p of lineage) {
    const key = [
      p.birth?.slice(0, 3) ?? "UNK", // century cluster
      p.birthPlace ?? "UNK",         // geographic cluster
      p.name?.split(" ")[0] ?? "UNK" // first-name cluster
    ].join("|");

    if (!clusters.has(key)) {
      clusters.set(key, []);
    }

    clusters.get(key).push(p.id);
  }

  return [...clusters.entries()].map(([clusterKey, members]) => ({
    clusterKey,
    members
  }));
}
