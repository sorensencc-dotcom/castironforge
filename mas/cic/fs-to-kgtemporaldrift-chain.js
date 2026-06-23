// fs-to-kgtemporaldrift-chain.js — 2026-06-22 — v1.0.0

import { extractFamilySearchTemporal } from "./fs-temporal-extract.js";
import { normalizeFamilySearchTemporal } from "./kgtemporalnormalize-familysearch.js";
import { enhanceFamilySearchTemporalPrecision } from "./kgtemporalprecision-familysearch.js";
import { detectFamilySearchTemporalDrift } from "./kgtemporaldrift-familysearch.js";

/**
 * Full deterministic drift pipeline:
 * Previous FS → Extract → Normalize → Enhance
 * Current FS  → Extract → Normalize → Enhance
 * Then run CIC Temporal Drift Detector
 */
export function runFamilySearchTemporalDriftChain(previousFsPayload, currentFsPayload) {
  // Previous FS state
  const prevRaw = extractFamilySearchTemporal(previousFsPayload);
  const prevNorm = normalizeFamilySearchTemporal({ events: prevRaw });
  const prevEnhanced = enhanceFamilySearchTemporalPrecision({ events: prevNorm });

  // Current FS state
  const currRaw = extractFamilySearchTemporal(currentFsPayload);
  const currNorm = normalizeFamilySearchTemporal({ events: currRaw });
  const currEnhanced = enhanceFamilySearchTemporalPrecision({ events: currNorm });

  // Drift detection
  const drift = detectFamilySearchTemporalDrift({
    previous: prevEnhanced,
    current: currEnhanced
  });

  return {
    previous: {
      rawEvents: prevRaw,
      normalizedEvents: prevNorm,
      enhancedEvents: prevEnhanced
    },
    current: {
      rawEvents: currRaw,
      normalizedEvents: currNorm,
      enhancedEvents: currEnhanced
    },
    drift
  };
}
