// fs-to-kgtemporalstability-chain.js — 2026-06-22 — v1.0.0

import { extractFamilySearchTemporal } from "./fs-temporal-extract.js";
import { normalizeFamilySearchTemporal } from "./kgtemporalnormalize-familysearch.js";
import { enhanceFamilySearchTemporalPrecision } from "./kgtemporalprecision-familysearch.js";

/**
 * Evaluate temporal stability across:
 * • Current FS vs previous FS snapshots
 * • FS vs other providers
 * • Precision consistency
 * • Ordering stability
 */
export function runFamilySearchTemporalStabilityChain(fsPayload, providerPayloads, previousFsPayload) {
  // FS current
  const fsRaw = extractFamilySearchTemporal(fsPayload);
  const fsNorm = normalizeFamilySearchTemporal({ events: fsRaw });
  const fsEnhanced = enhanceFamilySearchTemporalPrecision({ events: fsNorm });

  // FS previous
  const prevRaw = extractFamilySearchTemporal(previousFsPayload ?? {});
  const prevNorm = normalizeFamilySearchTemporal({ events: prevRaw });
  const prevEnhanced = enhanceFamilySearchTemporalPrecision({ events: prevNorm });

  // Providers
  const providerEvents = {};
  for (const provider of Object.keys(providerPayloads ?? {})) {
    const raw = extractFamilySearchTemporal(providerPayloads[provider]);
    const norm = normalizeFamilySearchTemporal({ events: raw });
    const enhanced = enhanceFamilySearchTemporalPrecision({ events: norm });
    providerEvents[provider] = enhanced;
  }

  // Compute stability metrics
  const stability = {
    currentEvents: fsEnhanced,
    previousEvents: prevEnhanced,
    providerEvents,
    metrics: {
      eventCount: fsEnhanced.length,
      precisionStability: computePrecisionStability(prevEnhanced, fsEnhanced),
      orderingStability: computeOrderingStability(fsEnhanced),
      providerAlignment: computeProviderAlignment(fsEnhanced, providerEvents)
    }
  };

  return stability;
}

function computePrecisionStability(previous, current) {
  if (previous.length === 0 || current.length === 0) return 1.0;
  let stable = 0;
  for (let i = 0; i < Math.min(previous.length, current.length); i++) {
    if (previous[i].precision === current[i].precision) stable++;
  }
  return stable / Math.max(previous.length, current.length);
}

function computeOrderingStability(events) {
  for (let i = 1; i < events.length; i++) {
    const curr = parseInt(events[i].normalizedDate?.slice(0, 4) ?? 0);
    const prev = parseInt(events[i - 1].normalizedDate?.slice(0, 4) ?? 0);
    if (curr < prev) return 0.0;
  }
  return 1.0;
}

function computeProviderAlignment(fsEvents, providerEvents) {
  const alignment = {};
  for (const provider of Object.keys(providerEvents)) {
    const events = providerEvents[provider];
    let matches = 0;
    for (const fe of fsEvents) {
      if (events.some(e => e.type === fe.type && e.normalizedDate === fe.normalizedDate)) matches++;
    }
    alignment[provider] = fsEvents.length > 0 ? matches / fsEvents.length : 0;
  }
  return alignment;
}
