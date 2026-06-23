// fs-to-kgtemporalprecision-chain.js — 2026-06-22 — v1.0.0

import { extractFamilySearchTemporal } from "./fs-temporal-extract.js";
import { normalizeFamilySearchTemporal } from "./kgtemporalnormalize-familysearch.js";
import { enhanceFamilySearchTemporalPrecision } from "./kgtemporalprecision-familysearch.js";

export function runFamilySearchTemporalPrecisionChain(fsPayload) {
  const raw = extractFamilySearchTemporal(fsPayload);
  const normalized = normalizeFamilySearchTemporal({ events: raw });
  const enhanced = enhanceFamilySearchTemporalPrecision({ events: normalized });
  return enhanced;
}
