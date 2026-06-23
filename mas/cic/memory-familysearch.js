// memory-familysearch.js — 2026-06-22 — v1.0.0

export function consolidateFamilySearchMemory({ memory, payload }) {
  const updated = { ...memory };

  if (payload.person) {
    updated.lastKnownPerson = {
      name: payload.person.display?.name,
      birth: payload.person.display?.birthDate,
      death: payload.person.display?.deathDate
    };
  }

  updated.lastFamilySearchRun = Date.now();

  updated.evidence = [
    ...(memory.evidence ?? []),
    ...(payload.records ?? []),
    ...(payload.memories ?? [])
  ];

  return updated;
}
