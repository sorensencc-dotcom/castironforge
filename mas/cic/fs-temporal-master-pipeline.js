// fs-temporal-master-pipeline.js — 2026-06-22 — v1.0.0

import { runFamilySearchTemporalConsistencyChain } from "./fs-to-kgtemporalconsistency-chain.js";
import { runFamilySearchTemporalDriftChain } from "./fs-to-kgtemporaldrift-chain.js";
import { runFamilySearchTemporalArbitrationV2 } from "./fs-to-temporalarbitrationv2-chain.js";
import { runFamilySearchTemporalStabilityChain } from "./fs-to-kgtemporalstability-chain.js";
import { runFamilySearchTemporalReconstructionChain } from "./fs-to-temporalreconstruction-chain.js";

/**
 * Master FamilySearch Temporal Pipeline
 *
 * Runs full deterministic temporal processing:
 * 1. Consistency check (birth < death, chronological ordering)
 * 2. Drift detection (previous vs current)
 * 3. Multi-provider arbitration (FS vs other sources)
 * 4. Stability evaluation (precision, ordering, alignment)
 * 5. Predictive reconstruction (missing dates)
 *
 * Zero nondeterminism. Operator-grade CIC stage.
 */
export function runFamilySearchTemporalPipeline({
  previousFs,
  currentFs,
  providerPayloads,
  providerStats
}) {
  const consistency = runFamilySearchTemporalConsistencyChain(currentFs);
  const drift = runFamilySearchTemporalDriftChain(previousFs, currentFs);
  const arbitration = runFamilySearchTemporalArbitrationV2(currentFs, providerPayloads, providerStats);
  const stability = runFamilySearchTemporalStabilityChain(currentFs, providerPayloads, previousFs);
  const reconstruction = runFamilySearchTemporalReconstructionChain(currentFs);

  return {
    consistency,
    drift,
    arbitration,
    stability,
    reconstruction
  };
}
