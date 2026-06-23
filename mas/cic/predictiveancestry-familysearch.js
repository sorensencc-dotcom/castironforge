// predictiveancestry-familysearch.js — 2026-06-22 — v1.0.0

import { computeLifespan } from "../lib/lifespan-util.js";

export function predictFamilySearchAncestry({ lineage }) {
  const predictions = [];

  for (const p of lineage) {
    // Missing parents
    if ((p.parents?.length ?? 0) === 0) {
      predictions.push({
        id: p.id,
        type: "MISSING_PARENTS",
        reason: "No parent records found",
        confidence: 0.7
      });
    }

    // Missing children but lifespan suggests possibility
    if ((p.children?.length ?? 0) === 0 && p.birth && p.death) {
      const lifespan = computeLifespan(p.birth, p.death);
      if (lifespan && lifespan > 40) {
        predictions.push({
          id: p.id,
          type: "POSSIBLE_CHILDREN",
          reason: "Long lifespan with no recorded descendants",
          confidence: 0.4
        });
      }
    }

    // Generational gap detection
    if (p.birth && p.parents?.length > 0) {
      for (const parentId of p.parents) {
        const parent = lineage.find(x => x.id === parentId);
        if (parent?.birth) {
          const gap = parseInt(p.birth) - parseInt(parent.birth);
          if (gap < 12 || gap > 60) {
            predictions.push({
              id: p.id,
              type: "GENERATIONAL_GAP",
              parentId,
              gap,
              confidence: 0.9
            });
          }
        }
      }
    }
  }

  return predictions;
}
