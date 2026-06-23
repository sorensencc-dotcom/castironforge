// kg-familysearch.js — 2026-06-22 — v1.0.0

export function mapFamilySearchToKG({ payload }) {
  if (!payload?.person) {
    return { nodes: [], edges: [] };
  }

  const nodes = [];
  const edges = [];

  const p = payload.person;

  // Person node
  nodes.push({
    id: `fs-person-${p.id}`,
    type: "Person",
    source: "familysearch",
    name: p.display?.name ?? null,
    gender: p.display?.gender ?? null,
    birth: p.display?.birthDate ?? null,
    death: p.display?.deathDate ?? null
  });

  // Memories → Artifact nodes
  for (const m of payload.memories ?? []) {
    const memId = `fs-memory-${m.id}`;

    nodes.push({
      id: memId,
      type: "Artifact",
      source: "familysearch",
      title: m.title,
      mediaType: m.type
    });

    edges.push({
      from: memId,
      to: `fs-person-${p.id}`,
      type: "ABOUT"
    });
  }

  // Records → Evidence nodes
  for (const r of payload.records ?? []) {
    const recId = `fs-record-${r.id}`;

    nodes.push({
      id: recId,
      type: "Record",
      source: "familysearch",
      title: r.title ?? null,
      collection: r.collection ?? null
    });

    edges.push({
      from: recId,
      to: `fs-person-${p.id}`,
      type: "EVIDENCE_FOR"
    });
  }

  return { nodes, edges };
}
