// cic-run-fs-temporal.js — 2026-06-22 — v1.0.0
// CIC FamilySearch Temporal Pipeline execution wrapper
// Runs the complete temporal pipeline on CIC

import { cicFamilySearchTemporalStage } from "./cic-fs-temporal-stage.js";
import { pipeline } from "./cic-pipeline-config.js";

/**
 * Execute the full FamilySearch Temporal Pipeline on CIC
 *
 * This function:
 * 1. Loads FamilySearch snapshots (previous and current)
 * 2. Loads provider payloads (Ancestry, MyHeritage, FindAGrave, etc.)
 * 3. Loads provider reliability stats
 * 4. Runs the unified temporal pipeline
 * 5. Returns complete temporal block with all engine outputs
 */
export async function runFamilySearchTemporalPipeline({
  previousFs,
  currentFs,
  providerPayloads,
  providerStats
}) {
  const ctx = {
    input: {
      previousFs,
      currentFs,
      providerPayloads,
      providerStats
    },
    output: {}
  };

  // Execute the CIC stage (which calls all 8 engines)
  await cicFamilySearchTemporalStage(ctx);

  return {
    pipelineId: pipeline.id,
    status: "complete",
    temporal: ctx.output.temporal
  };
}

/**
 * Example usage:
 *
 * const previousFs = await loadSnapshot("fs-prev.json");
 * const currentFs = await loadSnapshot("fs-current.json");
 * const providerPayloads = await loadProviders();
 * const providerStats = await loadProviderStats();
 *
 * const result = await runFamilySearchTemporalPipeline({
 *   previousFs,
 *   currentFs,
 *   providerPayloads,
 *   providerStats
 * });
 *
 * // result.temporal contains:
 * // - current, previous, providers (all stages of processing)
 * // - consistency (violations)
 * // - drift (changes)
 * // - arbitration (decisions)
 * // - stability (metrics)
 * // - reconstruction (inferred dates)
 */
