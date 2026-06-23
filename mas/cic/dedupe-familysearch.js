// dedupe-familysearch.js — 2026-06-22 — v1.0.0

export function dedupeFamilySearchNodes({ nodes }) {
  const seen = new Map();
  const output = [];

  for (const n of nodes) {
    const key = `${n.type}:${n.name ?? n.title ?? n.id}`;

    if (!seen.has(key)) {
      seen.set(key, n);
      output.push(n);
      continue;
    }

    // Merge lightweight attributes
    const existing = seen.get(key);

    existing.sources = Array.from(
      new Set([...(existing.sources ?? []), "familysearch"])
    );

    if (n.birth && !existing.birth) existing.birth = n.birth;
    if (n.death && !existing.death) existing.death = n.death;
  }

  return output;
}
