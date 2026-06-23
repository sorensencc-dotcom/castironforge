// cic-fs-temporal-stage.js — 2026-06-22 — v1.0.0
// CIC pipeline hook for FamilySearch temporal processing

import { runCicFamilySearchTemporalPipeline } from "./cic-fs-temporal-master.js";

export async function cicFamilySearchTemporalStage(ctx) {
  const { previousFs, currentFs, providerPayloads, providerStats } = ctx.input;
  ctx.output.temporal = runCicFamilySearchTemporalPipeline({
    previousFs,
    currentFs,
    providerPayloads,
    providerStats
  });
}
