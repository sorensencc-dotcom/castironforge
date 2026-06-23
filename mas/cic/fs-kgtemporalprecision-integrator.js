// fs-kgtemporalprecision-integrator.js — 2026-06-22 — v1.0.0

import { normalizeFamilySearchTemporal } from "./kgtemporalnormalize-familysearch.js";
import { enhanceFamilySearchTemporalPrecision } from "./kgtemporalprecision-familysearch.js";

/**
 * Integrate FamilySearch temporal data into CIC KG Temporal Precision Enhancer.
 *
 * Input shape (FamilySearch-ish):
 * {
 *   person: {
 *     display: {
 *       birthDate: "1875-03-12",
 *       deathDate: "1942",
 *     }
 *   },
 *   records: [
 *     { id: "r1", type: "CENSUS", date: "1910" },
 *     { id: "r2", type: "MARRIAGE", date: "1899-06" }
 *   ]
 * }
 */
export function integrateFamilySearchIntoTemporalPrecisionEnhancer(fsPayload) {
  const events = [];

  const p = fsPayload.person;

  // Birth
  if (p?.display?.birthDate) {
    events.push({
      type: "BIRTH",
      date: p.display.birthDate,
      source: "familysearch"
    });
  }

  // Death
  if (p?.display?.deathDate) {
    events.push({
      type: "DEATH",
      date: p.display.deathDate,
      source: "familysearch"
    });
  }

  // Records → generic events
  for (const r of fsPayload.records ?? []) {
    if (!r.date) continue;
    events.push({
      type: r.type?.toUpperCase() || "RECORD",
      date: r.date,
      source: "familysearch",
      recordId: r.id
    });
  }

  // 1) Normalize to CIC canonical temporal schema
  const normalized = normalizeFamilySearchTemporal({ events });

  // 2) Enhance precision deterministically
  const enhanced = enhanceFamilySearchTemporalPrecision({ events: normalized });

  return enhanced;
}
