// semanticcompress-familysearch.js — 2026-06-22 — v1.0.0

export function compressFamilySearchSemantics({ payload }) {
  const p = payload.person;

  return {
    personToken: p ? `P:${p.display?.name ?? "?"}` : null,
    birthToken: p?.display?.birthDate ? `B:${p.display.birthDate}` : null,
    deathToken: p?.display?.deathDate ? `D:${p.display.deathDate}` : null,
    recordTokens: (payload.records ?? []).map(r => `R:${r.title}`),
    memoryTokens: (payload.memories ?? []).map(m => `M:${m.title}`)
  };
}
