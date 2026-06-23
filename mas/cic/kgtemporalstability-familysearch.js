// kgtemporalstability-familysearch.js — 2026-06-22 — v1.0.0
// KG Temporal Stability Engine for FamilySearch

export function computeFamilySearchTemporalStability({ current, previous, providers }) {
  if (!current || !previous) {
    return {
      metrics: {
        birth: 0.5,
        death: 0.5,
        marriage: 0.5,
        ordering: 0.5,
        precision: 0.5,
        cross_provider: 0.5,
        composite_stability: 0.5
      }
    };
  }

  const birthStability = computeEventStability(current, previous, providers, "BIRTH");
  const deathStability = computeEventStability(current, previous, providers, "DEATH");
  const marriageStability = computeEventStability(current, previous, providers, "MARRIAGE");
  const orderingStability = computeOrderingStability(current);
  const precisionStability = computePrecisionStability(previous, current);
  const crossProviderStability = computeCrossProviderStability(current, providers);

  const composite = (birthStability + deathStability + marriageStability + orderingStability + precisionStability + crossProviderStability) / 6;

  return {
    metrics: {
      birth: Math.round(birthStability * 100) / 100,
      death: Math.round(deathStability * 100) / 100,
      marriage: Math.round(marriageStability * 100) / 100,
      ordering: Math.round(orderingStability * 100) / 100,
      precision: Math.round(precisionStability * 100) / 100,
      cross_provider: Math.round(crossProviderStability * 100) / 100,
      composite_stability: Math.round(composite * 100) / 100
    }
  };
}

function computeEventStability(current, previous, providers, eventType) {
  const currEvent = current?.find(e => e.type === eventType);
  const prevEvent = previous?.find(e => e.type === eventType);

  let agreement = 0;
  let total = 0;

  if (currEvent && prevEvent) {
    agreement += currEvent.normalizedDate === prevEvent.normalizedDate ? 1 : 0;
    total++;
  }

  if (currEvent && providers) {
    for (const provider of Object.keys(providers || {})) {
      const pEvent = providers[provider]?.find(e => e.type === eventType);
      if (pEvent) {
        agreement += currEvent.normalizedDate === pEvent.normalizedDate ? 1 : 0;
        total++;
      }
    }
  }

  return total > 0 ? agreement / total : 0.5;
}

function computeOrderingStability(events) {
  if (!events || events.length < 2) return 1.0;

  for (let i = 1; i < events.length; i++) {
    const curr = parseInt(events[i].normalizedDate?.slice(0, 4) ?? 0);
    const prev = parseInt(events[i - 1].normalizedDate?.slice(0, 4) ?? 0);
    if (curr < prev) return 0.0;
  }

  return 1.0;
}

function computePrecisionStability(previous, current) {
  if (!previous || !current || previous.length === 0 || current.length === 0) return 0.5;

  let stable = 0;
  for (let i = 0; i < Math.min(previous.length, current.length); i++) {
    if (previous[i].precision === current[i].precision) stable++;
  }

  return stable / Math.max(previous.length, current.length);
}

function computeCrossProviderStability(current, providers) {
  if (!providers || Object.keys(providers).length === 0) return 0.5;

  let alignments = [];

  for (const provider of Object.keys(providers || {})) {
    const providerEvents = providers[provider];
    let matches = 0;

    for (const ce of current) {
      if (providerEvents.some(e => e.type === ce.type && e.normalizedDate === ce.normalizedDate)) {
        matches++;
      }
    }

    alignments.push(current.length > 0 ? matches / current.length : 0.5);
  }

  return alignments.length > 0 ? alignments.reduce((a, b) => a + b) / alignments.length : 0.5;
}
