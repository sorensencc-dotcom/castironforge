// fusion-familysearch.js — 2026-06-22 — v1.0.0

export function fuseFamilySearchContext({ kg, context }) {
  const fsNodes = kg.nodes.filter(n => n.source === "familysearch");

  if (fsNodes.length === 0) return context;

  return {
    ...context,
    familysearch: {
      persons: fsNodes.filter(n => n.type === "Person"),
      artifacts: fsNodes.filter(n => n.type === "Artifact"),
      records: fsNodes.filter(n => n.type === "Record")
    }
  };
}
