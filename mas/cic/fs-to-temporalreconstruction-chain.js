// fs-to-temporalreconstruction-chain.js — 2026-06-22 — v1.0.0

import { extractFamilySearchTemporal } from "./fs-temporal-extract.js";
import { normalizeFamilySearchTemporal } from "./kgtemporalnormalize-familysearch.js";
import { enhanceFamilySearchTemporalPrecision } from "./kgtemporalprecision-familysearch.js";
import { reconstructFamilySearchTemporal } from "./temporalreconstruct-familysearch.js";

/**
 * FS → Predictive Temporal Reconstruction Engine
 *
 * Fills in missing temporal data deterministically:
 * • missing birth (from death - 60 years, or fallback 1850)
 * • missing death (from birth + 70 years, or fallback 1920)
 * • missing marriage (birth + 25 years if both birth/death known)
 */
export function runFamilySearchTemporalReconstructionChain(fsPayload) {
  const raw = extractFamilySearchTemporal(fsPayload);
  const norm = normalizeFamilySearchTemporal({ events: raw });
  const enhanced = enhanceFamilySearchTemporalPrecision({ events: norm });

  const reconstruction = reconstructFamilySearchTemporal({
    person: {
      birth: enhanced.find(e => e.type === "BIRTH")?.normalizedDate,
      death: enhanced.find(e => e.type === "DEATH")?.normalizedDate
    }
  });

  return {
    rawEvents: raw,
    normalizedEvents: norm,
    enhancedEvents: enhanced,
    reconstruction
  };
}
