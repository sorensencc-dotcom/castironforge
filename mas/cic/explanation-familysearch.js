// explanation-familysearch.js — 2026-06-22 — v1.0.0

export function explainFamilySearchDecision({ payload, reliability, conflicts, alignments }) {
  const lines = [];

  if (payload.person) {
    lines.push(`Identified person: ${payload.person.display?.name}`);
  } else {
    lines.push("No person identified in FamilySearch results.");
  }

  lines.push(`Reliability score: ${reliability.reliability}`);

  if (conflicts.length > 0) {
    lines.push(`Detected ${conflicts.length} conflict(s):`);
    for (const c of conflicts) {
      lines.push(` - ${c.type}: ${c.message}`);
    }
  }

  for (const a of alignments) {
    lines.push(
      `Alignment with ${a.provider}: ${a.match ? "MATCH" : "NO MATCH"} (${a.reason})`
    );
  }

  return lines.join(" ");
}
