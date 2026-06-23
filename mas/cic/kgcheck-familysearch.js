// kgcheck-familysearch.js — 2026-06-22 — v1.0.0

export function checkFamilySearchKGConsistency({ nodes, edges }) {
  const issues = [];

  // Rule 1: Person nodes must have unique IDs
  const ids = new Set();
  for (const n of nodes) {
    if (ids.has(n.id)) {
      issues.push({
        type: "DUPLICATE_NODE",
        nodeId: n.id,
        message: "Duplicate FamilySearch node detected"
      });
    }
    ids.add(n.id);
  }

  // Rule 2: Edges must reference valid nodes
  for (const e of edges) {
    const fromExists = nodes.some(n => n.id === e.from);
    const toExists = nodes.some(n => n.id === e.to);

    if (!fromExists || !toExists) {
      issues.push({
        type: "INVALID_EDGE",
        edge: e,
        message: "Edge references missing node(s)"
      });
    }
  }

  // Rule 3: No cycles in ancestry (simple check)
  const ancestryEdges = edges.filter(e => e.type === "PARENT_OF");
  const visited = new Set();

  function dfs(id, path = []) {
    if (path.includes(id)) {
      issues.push({
        type: "ANCESTRY_CYCLE",
        path: [...path, id],
        message: "Cycle detected in ancestry graph"
      });
      return;
    }

    const children = ancestryEdges
      .filter(e => e.from === id)
      .map(e => e.to);

    for (const c of children) {
      dfs(c, [...path, id]);
    }
  }

  for (const n of nodes) dfs(n.id);

  return issues;
}
