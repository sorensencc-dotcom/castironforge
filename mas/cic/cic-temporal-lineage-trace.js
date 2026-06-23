// cic-temporal-lineage-trace.js — 2026-06-22 — v1.0.0
// CIC Temporal Lineage Trace Generator
// Produces operator-grade lineage traces showing how each temporal value flowed through the pipeline

export function generateTemporalLineageTrace(pipelineOutput, entityId) {
  const {
    current,
    previous,
    providers,
    consistency,
    drift,
    arbitration,
    stability,
    reconstruction
  } = pipelineOutput;

  const trace = {
    entityId,
    timestamp: new Date().toISOString(),
    eventLineages: {
      birth: generateEventLineage("BIRTH", current, previous, providers, consistency, drift, arbitration, stability, reconstruction),
      death: generateEventLineage("DEATH", current, previous, providers, consistency, drift, arbitration, stability, reconstruction),
      marriage: generateEventLineage("MARRIAGE", current, previous, providers, consistency, drift, arbitration, stability, reconstruction)
    },
    providerAgreement: analyzeProviderAgreement(current, providers),
    finalValues: extractFinalValues(arbitration, reconstruction)
  };

  return trace;
}

function generateEventLineage(eventType, current, previous, providers, consistency, drift, arbitration, stability, reconstruction) {
  const currentEvent = current?.enhanced?.find(e => e.type === eventType);
  const previousEvent = previous?.enhanced?.find(e => e.type === eventType);
  const providerEvents = {};

  for (const provider of Object.keys(providers || {})) {
    const evt = providers[provider]?.find(e => e.type === eventType);
    if (evt) providerEvents[provider] = evt;
  }

  const consistencyIssue = consistency?.issues?.find(i => i.type && i.type.includes(eventType));
  const driftIssue = drift?.drift?.find(d => d.type === eventType);
  const arbitrationDecision = arbitration?.decisions?.find(d => d.field === eventType.toLowerCase() + "Date");
  const stabilityScore = stability?.metrics?.[eventType.toLowerCase()] ?? null;
  const reconstructionValue = reconstruction?.[eventType.toLowerCase()] ?? null;

  return {
    rawInputs: {
      fsCurrent: currentEvent?.date,
      fsPrevious: previousEvent?.date,
      providers: providerEvents
    },
    normalized: {
      fsCurrent: currentEvent?.normalizedDate,
      fsPrevious: previousEvent?.normalizedDate,
      precision: currentEvent?.precision,
      providers: Object.entries(providerEvents).reduce((acc, [k, v]) => {
        acc[k] = { date: v.normalizedDate, precision: v.precision };
        return acc;
      }, {})
    },
    precisionEnhancement: {
      upgraded: currentEvent?.precision === "INFERRED_DAY",
      from: "YEAR",
      to: "INFERRED_DAY"
    },
    consistency: {
      anomaly: consistencyIssue?.type,
      severity: consistencyIssue ? "CRITICAL" : "NONE",
      details: consistencyIssue?.reason
    },
    drift: {
      previous: previousEvent?.normalizedDate,
      current: currentEvent?.normalizedDate,
      magnitude: driftIssue?.driftMagnitude,
      severity: driftIssue ? (driftIssue.driftMagnitude >= 10 ? "CRITICAL" : "MAJOR") : "NONE"
    },
    arbitration: {
      decision: arbitrationDecision?.winner,
      reason: arbitrationDecision?.reason,
      fsValue: arbitrationDecision?.fsValue,
      otherValue: arbitrationDecision?.otherValue,
      comparedAgainst: arbitrationDecision?.comparedAgainst
    },
    stability: {
      score: stabilityScore,
      factors: {
        crossProviderAgreement: stabilityScore >= 0.8 ? "high" : stabilityScore >= 0.6 ? "moderate" : "low",
        driftPresent: driftIssue ? true : false,
        precisionLevel: currentEvent?.precision
      }
    },
    reconstruction: {
      inferred: reconstructionValue,
      confidence: eventType === "MARRIAGE" ? 0.78 : 0.45
    },
    finalValue: {
      value: arbitrationDecision?.winner === "familysearch" ? currentEvent?.normalizedDate :
             arbitrationDecision?.otherValue ? arbitrationDecision.otherValue :
             reconstructionValue,
      source: arbitrationDecision?.winner || "ReconstructionEngine",
      precision: currentEvent?.precision,
      lineage: buildLineagePath(eventType, arbitrationDecision, reconstructionValue)
    }
  };
}

function buildLineagePath(eventType, arbitrationDecision, reconstructionValue) {
  if (!arbitrationDecision && reconstructionValue) {
    return `extraction → normalization → precision → reconstruction → arbitration`;
  }
  if (arbitrationDecision?.winner === "familysearch") {
    return `fs.current → normalize → precision → consistency → drift → arbitration`;
  }
  return `providers → normalize → precision → arbitration → stability`;
}

function analyzeProviderAgreement(current, providers) {
  const birthYears = [];
  const deathYears = [];

  const currBirth = current?.enhanced?.find(e => e.type === "BIRTH")?.normalizedDate;
  if (currBirth) birthYears.push(parseInt(currBirth.slice(0, 4)));

  const currDeath = current?.enhanced?.find(e => e.type === "DEATH")?.normalizedDate;
  if (currDeath) deathYears.push(parseInt(currDeath.slice(0, 4)));

  for (const provider of Object.keys(providers || {})) {
    const pBirth = providers[provider]?.find(e => e.type === "BIRTH")?.normalizedDate;
    if (pBirth) birthYears.push(parseInt(pBirth.slice(0, 4)));

    const pDeath = providers[provider]?.find(e => e.type === "DEATH")?.normalizedDate;
    if (pDeath) deathYears.push(parseInt(pDeath.slice(0, 4)));
  }

  return {
    birth: {
      spread: birthYears.length > 0 ? Math.max(...birthYears) - Math.min(...birthYears) : 0,
      values: birthYears,
      agreement: birthYears.length > 0 ? Math.max(...birthYears) - Math.min(...birthYears) <= 2 ? "high" : "low" : "none"
    },
    death: {
      spread: deathYears.length > 0 ? Math.max(...deathYears) - Math.min(...deathYears) : 0,
      values: deathYears,
      agreement: deathYears.length > 0 ? Math.max(...deathYears) - Math.min(...deathYears) <= 2 ? "high" : "low" : "none"
    }
  };
}

function extractFinalValues(arbitration, reconstruction) {
  const values = {};

  if (arbitration?.decisions) {
    for (const decision of arbitration.decisions) {
      values[decision.field] = {
        value: decision.winner === "familysearch" ? decision.fsValue : decision.otherValue,
        source: decision.winner,
        precision: decision.precision
      };
    }
  }

  if (reconstruction) {
    if (!values.birth) values.birth = { value: reconstruction.birth, source: "ReconstructionEngine" };
    if (!values.death) values.death = { value: reconstruction.death, source: "ReconstructionEngine" };
    if (!values.marriage) values.marriage = { value: reconstruction.marriage, source: "ReconstructionEngine" };
  }

  return values;
}
