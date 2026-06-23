// cic-fs-temporal-master.js — 2026-06-22 — v1.0.0
// Single unified CIC entrypoint for FamilySearch temporal pipeline
// Orchestrates all 8 temporal engines in deterministic order

import { extractFamilySearchTemporal } from "./fs-temporal-extract.js";
import { normalizeFamilySearchTemporal } from "./kgtemporalnormalize-familysearch.js";
import { enhanceFamilySearchTemporalPrecision } from "./kgtemporalprecision-familysearch.js";
import { checkFamilySearchTemporalConsistency } from "./kgtemporalconsistency-familysearch.js";
import { detectFamilySearchTemporalDrift } from "./kgtemporaldrift-familysearch.js";
import { arbitrateFamilySearchTemporalV2 } from "./temporalarbitrationv2-familysearch.js";
import { computeFamilySearchTemporalStability } from "./kgtemporalstability-familysearch.js";
import { reconstructFamilySearchTemporal } from "./temporalreconstruct-familysearch.js";

/**
 * CIC FamilySearch Temporal Master Pipeline
 *
 * Unified orchestrator that runs all 8 temporal engines:
 * 1. Extract raw events from FS payload
 * 2. Normalize to CIC canonical schema
 * 3. Enhance precision deterministically
 * 4. Check temporal consistency (invariants)
 * 5. Detect drift (previous vs current)
 * 6. Arbitrate conflicts across providers
 * 7. Evaluate stability metrics
 * 8. Reconstruct missing dates
 *
 * Zero nondeterminism. Reproducible across runs.
 * CIC calls this once per ingestion cycle.
 */
export function runCicFamilySearchTemporalPipeline({
  previousFs,
  currentFs,
  providerPayloads,
  providerStats
}) {
  // 1. Extract → Normalize → Enhance (CURRENT)
  const currRaw = extractFamilySearchTemporal(currentFs);
  const currNorm = normalizeFamilySearchTemporal({ events: currRaw });
  const currEnhanced = enhanceFamilySearchTemporalPrecision({ events: currNorm });

  // 2. Extract → Normalize → Enhance (PREVIOUS)
  const prevRaw = extractFamilySearchTemporal(previousFs ?? {});
  const prevNorm = normalizeFamilySearchTemporal({ events: prevRaw });
  const prevEnhanced = enhanceFamilySearchTemporalPrecision({ events: prevNorm });

  // 3. Providers through same deterministic pipeline
  const providerEvents = {};
  for (const provider of Object.keys(providerPayloads ?? {})) {
    const raw = extractFamilySearchTemporal(providerPayloads[provider]);
    const norm = normalizeFamilySearchTemporal({ events: raw });
    const enhanced = enhanceFamilySearchTemporalPrecision({ events: norm });
    providerEvents[provider] = enhanced;
  }

  // 4. Consistency Engine — validate invariants
  const consistency = checkFamilySearchTemporalConsistency({
    events: currEnhanced
  });

  // 5. Drift Detector — compare previous vs current
  const drift = detectFamilySearchTemporalDrift({
    previous: prevEnhanced,
    current: currEnhanced
  });

  // 6. Temporal Arbitration v2 — multi-provider conflict resolution
  const arbitration = arbitrateFamilySearchTemporalV2({
    fsEvents: currEnhanced,
    providerEvents,
    providerStats
  });

  // 7. Temporal Stability Engine — metrics
  const stability = computeFamilySearchTemporalStability({
    current: currEnhanced,
    previous: prevEnhanced,
    providers: providerEvents
  });

  // 8. Predictive Temporal Reconstruction — missing date inference
  const reconstruction = reconstructFamilySearchTemporal({
    person: {
      birth: currEnhanced.find(e => e.type === "BIRTH")?.normalizedDate,
      death: currEnhanced.find(e => e.type === "DEATH")?.normalizedDate
    }
  });

  // Return full CIC temporal block
  return {
    current: { raw: currRaw, normalized: currNorm, enhanced: currEnhanced },
    previous: { raw: prevRaw, normalized: prevNorm, enhanced: prevEnhanced },
    providers: providerEvents,
    consistency,
    drift,
    arbitration,
    stability,
    reconstruction
  };
}
