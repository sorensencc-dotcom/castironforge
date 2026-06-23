// multihop-familysearch.js — 2026-06-22 — v1.0.0

export function familySearchMultiHopReason({ kg, startId, hops = 2 }) {
  const results = [];
  const queue = [{ id: startId, depth: 0 }];

  const visited = new Set([startId]);

  while (queue.length > 0) {
    const { id, depth } = queue.shift();

    if (depth >= hops) continue;

    const outgoing = kg.edges.filter(e => e.from === id);

    for (const e of outgoing) {
      if (!visited.has(e.to)) {
        visited.add(e.to);
        results.push({
          from: id,
          to: e.to,
          type: e.type,
          depth: depth + 1
        });
        queue.push({ id: e.to, depth: depth + 1 });
      }
    }
  }

  return results;
}
