// coordination-familysearch.js — 2026-06-22 — v1.0.0

export function coordinateFamilySearchAgents({ context, agents }) {
  const signals = [];

  for (const agent of agents) {
    if (agent.accepts("familysearch")) {
      signals.push({
        agent: agent.id,
        action: "PROCESS_FAMILYSEARCH",
        priority: agent.priority ?? 50
      });
    }
  }

  // Sort by priority (lower = earlier)
  signals.sort((a, b) => a.priority - b.priority);

  return signals;
}
