// evolution-familysearch.js — 2026-06-22 — v1.0.0

export function evolveFamilySearchKnowledge({ context, kg }) {
  const fsNodes = kg.nodes.filter(n => n.source === "familysearch");

  if (fsNodes.length === 0) return context;

  const summary = fsNodes
    .filter(n => n.type === "Person")
    .map(n => `${n.name ?? "Unknown"} (${n.birth ?? "?"}–${n.death ?? "?"})`)
    .join("; ");

  return {
    ...context,
    evolution: {
      ...context.evolution,
      familysearchSummary: summary
    }
  };
}
