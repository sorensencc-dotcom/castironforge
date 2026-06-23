// merge-familysearch.js — 2026-06-22 — v1.0.0

export function mergeFamilySearchWithOthers({ fs, others }) {
  const merged = { ...others };

  if (!fs?.person) return merged;

  const key = `${fs.person.display?.name}:${fs.person.display?.birthDate}`;

  if (!merged[key]) {
    merged[key] = {
      sources: ["familysearch"],
      person: fs.person,
      memories: fs.memories ?? [],
      records: fs.records ?? []
    };
  } else {
    const entry = merged[key];
    entry.sources.push("familysearch");

    entry.memories = [...entry.memories, ...(fs.memories ?? [])];
    entry.records = [...entry.records, ...(fs.records ?? [])];
  }

  return merged;
}
