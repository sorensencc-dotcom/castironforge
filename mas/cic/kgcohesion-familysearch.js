// kgcohesion-familysearch.js — 2026-06-22 — v1.0.0

export function analyzeFamilySearchKGCohesion({ nodes, edges }) {
  const adjacency = new Map();
  for (const n of nodes) adjacency.set(n.id, new Set());

  for (const e of edges) {
    adjacency.get(e.from)?.add(e.to);
    adjacency.get(e.to)?.add(e.from);
  }

  // Count connected components
  const visited = new Set();
  let components = 0;

  function dfs(id) {
    const stack = [id];
    while (stack.length) {
      const curr = stack.pop();
      if (visited.has(curr)) continue;
      visited.add(curr);
      for (const nxt of adjacency.get(curr)) stack.push(nxt);
    }
  }

  for (const id of adjacency.keys()) {
    if (!visited.has(id)) {
      components++;
      dfs(id);
    }
  }

  const cohesionScore = nodes.length > 0
    ? 1 - (components - 1) / nodes.length
    : 1;

  return {
    components,
    cohesionScore: Math.max(0, Math.min(1, cohesionScore))
  };
}
