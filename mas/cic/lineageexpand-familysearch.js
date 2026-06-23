// lineageexpand-familysearch.js — 2026-06-22 — v1.0.0

import { computeLifespan } from "../lib/lifespan-util.js";

export function predictFamilySearchLineageExpansion({ lineage }) {
  const predictions = [];

  for (const p of lineage) {
    const hasParents = (p.parents?.length ?? 0) > 0;
    const hasChildren = (p.children?.length ?? 0) > 0;

    // Predict missing parents
    if (!hasParents) {
      predictions.push({
        id: p.id,
        type: "MISSING_PARENTS",
        confidence: 0.75,
        reason: "No parent records found"
      });
    }

    // Predict missing children based on lifespan + era
    if (!hasChildren && p.birth && p.death) {
      const lifespan = computeLifespan(p.birth, p.death);
      if (lifespan && lifespan > 40) {
        predictions.push({
          id: p.id,
          type: "POSSIBLE_CHILDREN",
          confidence: 0.45,
          reason: "Long lifespan with no recorded descendants"
        });
      }
    }

    // Predict sibling clusters
    if (hasParents) {
      predictions.push({
        id: p.id,
        type: "POSSIBLE_SIBLINGS",
        confidence: 0.6,
        reason: "Shared parent implies sibling cluster"
      });
    }
  }

  return predictions;
}
