// kgdeltastream-familysearch.js — 2026-06-22 — v1.0.0

export function streamFamilySearchKGDelta({ oldKG, newKG, push }) {
  const added = newKG.nodes.filter(n => !oldKG.nodes.some(o => o.id === n.id));
  const removed = oldKG.nodes.filter(o => !newKG.nodes.some(n => n.id === o.id));

  const delta = {
    timestamp: Date.now(),
    added,
    removed
  };

  push(delta);
  return delta;
}
