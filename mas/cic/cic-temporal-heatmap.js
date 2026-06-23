// cic-temporal-heatmap.js — 2026-06-22 — v1.0.0
// CIC Temporal Anomaly Heatmap Generator
// Produces visual severity heatmaps for temporal anomalies

export function generateTemporalHeatmap(pipelineOutput) {
  const heatmap = {
    timestamp: new Date().toISOString(),
    events: {}
  };

  const eventTypes = ["BIRTH", "DEATH", "MARRIAGE", "CHILDREN", "MIGRATION"];

  for (const eventType of eventTypes) {
    heatmap.events[eventType] = generateEventHeatmap(eventType, pipelineOutput);
  }

  heatmap.composite = generateCompositeHeatmap(heatmap.events);

  return heatmap;
}

function generateEventHeatmap(eventType, pipelineOutput) {
  const { current, previous, providers, consistency, drift, arbitration, stability } = pipelineOutput;

  const currentEvent = current?.enhanced?.find(e => e.type === eventType);
  const previousEvent = previous?.enhanced?.find(e => e.type === eventType);

  // Calculate spread across providers
  const providerValues = [];
  for (const provider of Object.keys(providers || {})) {
    const evt = providers[provider]?.find(e => e.type === eventType);
    if (evt) providerValues.push(parseInt(evt.normalizedDate?.slice(0, 4) ?? 0));
  }
  if (currentEvent) providerValues.push(parseInt(currentEvent.normalizedDate?.slice(0, 4) ?? 0));

  const spread = providerValues.length > 0 ? Math.max(...providerValues) - Math.min(...providerValues) : 0;

  // Check for drift
  const driftIssue = drift?.drift?.find(d => d.type === eventType);
  const driftMagnitude = driftIssue?.driftMagnitude ?? 0;

  // Check precision
  const precision = currentEvent?.precision ?? "UNKNOWN";
  const precisionScore = precision === "DAY" ? 1.0 : precision === "MONTH" ? 0.7 : precision === "YEAR" ? 0.4 : 0.0;

  // Check consistency
  const consistencyIssue = consistency?.issues?.find(i => i.type && i.type.includes(eventType));
  const consistencyScore = consistencyIssue ? 0.0 : 1.0;

  // Get stability score
  const stabilityScore = stability?.metrics?.[eventType.toLowerCase()] ?? 0.5;

  // Calculate severity
  const severityScore = (precisionScore + consistencyScore + (1.0 - Math.min(spread / 10, 1.0)) + (1.0 - Math.min(driftMagnitude / 30, 1.0)) + stabilityScore) / 5;
  const severity = getSeverityLevel(severityScore, consistencyScore, driftMagnitude);

  return {
    spreadYears: spread,
    driftMagnitude,
    precision,
    consistencyViolations: consistencyIssue ? 1 : 0,
    stabilityScore: Math.round(stabilityScore * 100) / 100,
    severityScore: Math.round(severityScore * 100) / 100,
    severity,
    severityEmoji: getSeverityEmoji(severity),
    details: {
      crossProviderAgreement: spread <= 2 ? "high" : spread <= 5 ? "moderate" : "low",
      driftStatus: driftMagnitude === 0 ? "none" : driftMagnitude <= 5 ? "minor" : driftMagnitude <= 12 ? "major" : "critical",
      precisionLevel: precision,
      consistencyStatus: consistencyScore === 1.0 ? "valid" : "violations detected"
    }
  };
}

function getSeverityLevel(score, consistencyScore, driftMagnitude) {
  if (consistencyScore === 0.0 || driftMagnitude >= 10) return "CRITICAL";
  if (score < 0.5 || driftMagnitude >= 5) return "MAJOR";
  if (score < 0.7) return "MODERATE";
  if (score < 0.85) return "MINOR";
  return "STABLE";
}

function getSeverityEmoji(severity) {
  const emojis = {
    CRITICAL: "🟥",
    MAJOR: "🟧",
    MODERATE: "🟨",
    MINOR: "🟩",
    STABLE: "🟦"
  };
  return emojis[severity] || "⚪";
}

function generateCompositeHeatmap(eventHeatmaps) {
  const severityWeights = {
    CRITICAL: 5,
    MAJOR: 4,
    MODERATE: 3,
    MINOR: 2,
    STABLE: 1
  };

  let totalWeight = 0;
  let totalScore = 0;

  for (const [event, heatmap] of Object.entries(eventHeatmaps)) {
    const weight = severityWeights[heatmap.severity] || 0;
    totalWeight += weight;
    totalScore += heatmap.stabilityScore * (6 - weight);
  }

  const compositeScore = totalWeight > 0 ? (totalScore / totalWeight) * 0.4 + 0.6 : 0.76;
  const compositeSeverity = getSeverityLevel(compositeScore, 1.0, 0);

  return {
    compositeStability: Math.round(compositeScore * 100) / 100,
    compositeSeverity,
    emoji: getSeverityEmoji(compositeSeverity),
    breakdown: Object.entries(eventHeatmaps).reduce((acc, [event, hm]) => {
      acc[event] = hm.severityEmoji;
      return acc;
    }, {})
  };
}
