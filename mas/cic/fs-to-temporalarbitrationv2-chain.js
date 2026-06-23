// fs-to-temporalarbitrationv2-chain.js — 2026-06-22 — v1.0.0

import { extractFamilySearchTemporal } from "./fs-temporal-extract.js";
import { normalizeFamilySearchTemporal } from "./kgtemporalnormalize-familysearch.js";
import { enhanceFamilySearchTemporalPrecision } from "./kgtemporalprecision-familysearch.js";
import { arbitrateFamilySearchTemporalV2 } from "./temporalarbitrationv2-familysearch.js";

/**
 * Integrate FamilySearch into Multi‑Provider Temporal Arbitration v2.
 *
 * fsPayload: FamilySearch-shaped object
 * providerPayloads: { providerName: payload }
 * providerStats: { providerName: { reliability: number } }
 */
export function runFamilySearchTemporalArbitrationV2(fsPayload, providerPayloads, providerStats) {
  // FS temporal pipeline
  const fsRaw = extractFamilySearchTemporal(fsPayload);
  const fsNorm = normalizeFamilySearchTemporal({ events: fsRaw });
  const fsEnhanced = enhanceFamilySearchTemporalPrecision({ events: fsNorm });

  // Other providers through same pipeline
  const providerEvents = {};

  for (const provider of Object.keys(providerPayloads)) {
    const payload = providerPayloads[provider];
    const raw = extractFamilySearchTemporal(payload);
    const norm = normalizeFamilySearchTemporal({ events: raw });
    const enhanced = enhanceFamilySearchTemporalPrecision({ events: norm });
    providerEvents[provider] = enhanced;
  }

  // Arbitration v2
  const decisions = arbitrateFamilySearchTemporalV2({
    fsEvents: fsEnhanced,
    providerEvents,
    providerStats
  });

  return {
    fs: {
      rawEvents: fsRaw,
      normalizedEvents: fsNorm,
      enhancedEvents: fsEnhanced
    },
    providers: providerEvents,
    decisions
  };
}
