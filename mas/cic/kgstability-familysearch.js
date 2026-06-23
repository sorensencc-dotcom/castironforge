// kgstability-familysearch.js — 2026-06-22 — v1.0.0

export function analyzeFamilySearchKGStability({ previous, current }) {
  const stability = {
    unchangedNodes: 0,
    changedNodes: 0,
    removedNodes: 0,
    addedNodes: 0
  };

  const prevMap = new Map(previous.nodes.map(n => [n.id, n]));
  const currMap = new Map(current.nodes.map(n => [n.id, n]));

  for (const [id, prevNode] of prevMap.entries()) {
    if (!currMap.has(id)) {
      stability.removedNodes++;
      continue;
    }

    const currNode = currMap.get(id);
    const same =
      JSON.stringify(prevNode) === JSON.stringify(currNode);

    if (same) stability.unchangedNodes++;
    else stability.changedNodes++;
  }

  for (const id of currMap.keys()) {
    if (!prevMap.has(id)) stability.addedNodes++;
  }

  return stability;
}
