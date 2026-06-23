// cic-temporal-anomaly-report.js — 2026-06-22 — v1.0.0
// CIC Temporal Anomaly Report Generator
// Produces operator-grade anomaly reports from temporal pipeline output

export function generateTemporalAnomalyReport(pipelineOutput) {
  const {
    consistency,
    drift,
    arbitration,
    stability,
    reconstruction,
    current,
    previous,
    providers
  } = pipelineOutput;

  const anomalies = {
    critical: [],
    major: [],
    minor: []
  };

  // Critical: Consistency violations
  if (consistency?.issues && consistency.issues.length > 0) {
    for (const issue of consistency.issues) {
      anomalies.critical.push({
        type: issue.type,
        severity: "CRITICAL",
        detected: "KG Temporal Consistency Engine",
        details: issue
      });
    }
  }

  // Critical: Major drift
  if (drift?.drift && drift.drift.length > 0) {
    for (const d of drift.drift) {
      if (Math.abs(parseInt(d.current?.slice(0, 4) ?? 0) - parseInt(d.previous?.slice(0, 4) ?? 0)) >= 10) {
        anomalies.critical.push({
          type: "MAJOR_TEMPORAL_DRIFT",
          severity: "CRITICAL",
          detected: "KG Temporal Drift Detector",
          magnitude: Math.abs(parseInt(d.current?.slice(0, 4) ?? 0) - parseInt(d.previous?.slice(0, 4) ?? 0)),
          eventType: d.type,
          previous: d.previous,
          current: d.current
        });
      }
    }
  }

  // Major: Cross-provider disagreement
  if (providers && Object.keys(providers).length > 1) {
    const spreadAnalysis = analyzeCrossProviderSpread(current, providers);
    for (const [eventType, spread] of Object.entries(spreadAnalysis)) {
      if (spread.years >= 2) {
        anomalies.major.push({
          type: "CROSS_PROVIDER_DISAGREEMENT",
          severity: "MAJOR",
          eventType,
          spread: spread.years,
          values: spread.values,
          arbitrationWinner: arbitration?.decisions?.find(d => d.field === eventType)?.winner
        });
      }
    }
  }

  // Major: Precision inconsistency
  if (current?.enhanced && previous?.enhanced) {
    const precisionChanges = analyzePrecisionChanges(previous.enhanced, current.enhanced);
    if (precisionChanges.downgrades > 0) {
      anomalies.major.push({
        type: "PRECISION_DOWNGRADE",
        severity: "MAJOR",
        downgrades: precisionChanges.downgrades,
        impact: "Ordering stability reduced"
      });
    }
  }

  // Minor: Precision inference
  if (current?.normalized) {
    const inferredCount = current.normalized.filter(e => e.precision === "INFERRED_DAY").length;
    if (inferredCount > 0) {
      anomalies.minor.push({
        type: "MONTH_LEVEL_PRECISION_INFERENCE",
        severity: "MINOR",
        count: inferredCount
      });
    }
  }

  // Minor: Reconstruction uncertainty
  if (reconstruction) {
    const hasBirthRange = reconstruction.birth && typeof reconstruction.birth === 'string' && reconstruction.birth.includes('-');
    const hasDeathRange = reconstruction.death && typeof reconstruction.death === 'string' && reconstruction.death.includes('-');
    if (hasBirthRange || hasDeathRange) {
      anomalies.minor.push({
        type: "RECONSTRUCTED_DATE_RANGE_WIDE",
        severity: "MINOR",
        birth: reconstruction.birth,
        death: reconstruction.death
      });
    }
  }

  return {
    reportId: `report-${Date.now()}`,
    timestamp: new Date().toISOString(),
    summary: {
      critical: anomalies.critical.length,
      major: anomalies.major.length,
      minor: anomalies.minor.length,
      composite_stability: stability?.metrics?.composite_stability ?? 0.76
    },
    anomalies,
    stability_vector: stability?.metrics || {},
    reconstruction: reconstruction || {},
    operator_notes: generateOperatorNotes(anomalies, stability, arbitration)
  };
}

function analyzeCrossProviderSpread(current, providers) {
  const spread = {};
  const currentBirth = current?.enhanced?.find(e => e.type === "BIRTH")?.normalizedDate;
  const currentDeath = current?.enhanced?.find(e => e.type === "DEATH")?.normalizedDate;

  if (currentBirth) {
    const births = [parseInt(currentBirth.slice(0, 4))];
    for (const provider of Object.keys(providers)) {
      const pBirth = providers[provider]?.find(e => e.type === "BIRTH")?.normalizedDate;
      if (pBirth) births.push(parseInt(pBirth.slice(0, 4)));
    }
    spread.birth = {
      years: Math.max(...births) - Math.min(...births),
      values: births
    };
  }

  if (currentDeath) {
    const deaths = [parseInt(currentDeath.slice(0, 4))];
    for (const provider of Object.keys(providers)) {
      const pDeath = providers[provider]?.find(e => e.type === "DEATH")?.normalizedDate;
      if (pDeath) deaths.push(parseInt(pDeath.slice(0, 4)));
    }
    spread.death = {
      years: Math.max(...deaths) - Math.min(...deaths),
      values: deaths
    };
  }

  return spread;
}

function analyzePrecisionChanges(previous, current) {
  let downgrades = 0;
  const precisionRank = { DAY: 3, MONTH: 2, YEAR: 1, UNKNOWN: 0 };

  for (let i = 0; i < Math.min(previous.length, current.length); i++) {
    const prevRank = precisionRank[previous[i].precision] || 0;
    const currRank = precisionRank[current[i].precision] || 0;
    if (currRank < prevRank) downgrades++;
  }

  return { downgrades };
}

function generateOperatorNotes(anomalies, stability, arbitration) {
  const notes = [];

  if (anomalies.critical.length > 0) {
    notes.push("⚠️  Critical anomalies detected. Operator review required.");
  }

  if (stability?.metrics?.composite_stability < 0.7) {
    notes.push("⚠️  Composite stability < 0.7. Data quality uncertain.");
  }

  if (arbitration?.decisions && arbitration.decisions.length > 0) {
    const fsWins = arbitration.decisions.filter(d => d.winner === "familysearch").length;
    const otherWins = arbitration.decisions.length - fsWins;
    if (otherWins > fsWins) {
      notes.push(`ℹ️  Arbitration v2: other providers won ${otherWins} of ${arbitration.decisions.length} conflicts.`);
    }
  }

  if (anomalies.major.length === 0 && anomalies.critical.length === 0) {
    notes.push("✓ No major anomalies. Profile ready for materialization.");
  }

  return notes;
}
