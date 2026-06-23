// fs-to-kgtemporalconsistency-chain.js — 2026-06-22 — v1.0.0

import { extractFamilySearchTemporal } from "./fs-temporal-extract.js";
import { normalizeFamilySearchTemporal } from "./kgtemporalnormalize-familysearch.js";
import { enhanceFamilySearchTemporalPrecision } from "./kgtemporalprecision-familysearch.js";
import { checkFamilySearchTemporalConsistency } from "./kgtemporalconsistency-familysearch.js";

/**
 * Full deterministic chain:
 * FS Payload → Extract → Normalize → Enhance Precision → Consistency Check
 */
export function runFamilySearchTemporalConsistencyChain(fsPayload) {
  // 1) Extract raw FS temporal events
  const raw = extractFamilySearchTemporal(fsPayload);

  // 2) Normalize to CIC canonical schema
  const normalized = normalizeFamilySearchTemporal({ events: raw });

  // 3) Enhance precision deterministically
  const enhanced = enhanceFamilySearchTemporalPrecision({ events: normalized });

  // 4) Run CIC Temporal Consistency Engine
  const consistency = checkFamilySearchTemporalConsistency({ events: enhanced });

  return {
    rawEvents: raw,
    normalizedEvents: normalized,
    enhancedEvents: enhanced,
    consistencyIssues: consistency
  };
}
