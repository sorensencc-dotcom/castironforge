// kgstructintegrity-familysearch.js — 2026-06-22 — v1.0.0

export function checkFamilySearchKGStructuralIntegrity({ nodes, edges }) {
  const issues = [];
  const nodeSet = new Set(nodes.map(n => n.id));

  for (const e of edges) {
    if (!nodeSet.has(e.from)) {
      issues.push({
        type: "MISSING_SOURCE_NODE",
        edge: e
      });
    }
    if (!nodeSet.has(e.to)) {
      issues.push({
        type: "MISSING_TARGET_NODE",
        edge: e
      });
    }
  }

  // Detect cycles in parent-child graph
  const adjacency = new Map();
  for (const n of nodes) adjacency.set(n.id, []);
  for (const e of edges) {
    if (e.type === "PARENT_OF") adjacency.get(e.from).push(e.to);
  }

  const visited = new Set();
  const stack = new Set();

  function dfs(id) {
    if (stack.has(id)) return true;
    if (visited.has(id)) return false;

    visited.add(id);
    stack.add(id);

    for (const child of adjacency.get(id)) {
      if (dfs(child)) return true;
    }

    stack.delete(id);
    return false;
  }

  for (const id of adjacency.keys()) {
    if (dfs(id)) {
      issues.push({
        type: "CYCLE_DETECTED",
        node: id
      });
      break;
    }
  }

  return issues;
}
