// gendensity-familysearch.js — 2026-06-22 — v1.0.0

export function computeFamilySearchGenerationalDensity({ lineage }) {
  const generations = new Map();

  for (const p of lineage) {
    const gen = p.generation ?? 0;
    if (!generations.has(gen)) {
      generations.set(gen, {
        count: 0,
        totalRecords: 0,
        branching: 0
      });
    }

    const g = generations.get(gen);
    g.count++;
    g.totalRecords += p.records?.length ?? 0;
    g.branching += p.children?.length ?? 0;
  }

  const result = [];
  for (const [gen, data] of generations.entries()) {
    result.push({
      generation: gen,
      individuals: data.count,
      avgRecords: data.count > 0 ? data.totalRecords / data.count : 0,
      avgBranching: data.count > 0 ? data.branching / data.count : 0
    });
  }

  return result.sort((a, b) => a.generation - b.generation);
}
