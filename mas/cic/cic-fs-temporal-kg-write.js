// cic-fs-temporal-kg-write.js — 2026-06-23 — v1.0.0
// KG Write Adapter: Materializes temporal pipeline output into CIC Knowledge Graph

export function writeFamilySearchTemporalToKG({
  personId,
  pipelineOutput
}) {
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

  // Build canonical person node with arbitration decisions applied
  const canonicalPerson = buildCanonicalPerson({
    personId,
    currentEvents: current.enhanced,
    arbitrationDecisions: arbitration.decisions,
    stability: stability.metrics
  });

  // Build temporal event nodes with provenance tracking
  const temporalEvents = buildTemporalEvents({
    currentEvents: current.enhanced,
    previousEvents: previous.enhanced,
    providerEvents: providers,
    driftInfo: drift.drift,
    arbitrationDecisions: arbitration.decisions
  });

  // Build provenance graph (13 layers)
  const provenanceGraph = buildProvenanceGraph({
    personId,
    currentEvents: current.enhanced,
    providers,
    arbitrationDecisions: arbitration.decisions,
    stability: stability.metrics
  });

  // Build consistency edges (violations detected)
  const consistencyEdges = buildConsistencyEdges({
    personId,
    issues: consistency.issues,
    reconstruction
  });

  // Build stability metadata
  const stabilityMetadata = {
    personId,
    metrics: stability.metrics,
    eventCount: current.enhanced.length,
    providerCount: Object.keys(providers).length,
    driftMagnitude: drift.drift.length > 0
      ? Math.max(...drift.drift.map(d => d.driftMagnitude))
      : 0,
    reconstructionFlags: {
      hasMissingBirth: !current.enhanced.find(e => e.type === "BIRTH"),
      hasMissingDeath: !current.enhanced.find(e => e.type === "DEATH"),
      inferred: {
        birth: reconstruction.birth && !current.enhanced.find(e => e.type === "BIRTH"),
        death: reconstruction.death && !current.enhanced.find(e => e.type === "DEATH")
      }
    }
  };

  // Return the materialized KG block
  return {
    personId,
    block: {
      type: "TEMPORAL_MATERIALIZATION",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
      nodes: {
        canonical: canonicalPerson,
        events: temporalEvents
      },
      edges: {
        provenance: provenanceGraph,
        consistency: consistencyEdges
      },
      metadata: stabilityMetadata,
      indices: {
        eventsByType: buildEventIndex(temporalEvents),
        eventsByDate: buildDateIndex(temporalEvents),
        provenanceByLayer: buildLayerIndex(provenanceGraph)
      }
    }
  };
}

function buildCanonicalPerson({ personId, currentEvents, arbitrationDecisions, stability }) {
  const birthEvent = currentEvents.find(e => e.type === "BIRTH");
  const deathEvent = currentEvents.find(e => e.type === "DEATH");

  // Apply arbitration decisions to select canonical values
  const canonicalBirth = selectCanonicalValue(
    "birthDate",
    arbitrationDecisions,
    birthEvent?.normalizedDate
  );

  const canonicalDeath = selectCanonicalValue(
    "deathDate",
    arbitrationDecisions,
    deathEvent?.normalizedDate
  );

  return {
    id: personId,
    type: "Person",
    canonical: {
      birthDate: {
        value: canonicalBirth,
        confidence: stability.birth,
        precision: birthEvent?.precision ?? "UNKNOWN",
        source: "familysearch"
      },
      deathDate: {
        value: canonicalDeath,
        confidence: stability.death,
        precision: deathEvent?.precision ?? "UNKNOWN",
        source: "familysearch"
      }
    },
    temporalSpan: {
      birth: canonicalBirth,
      death: canonicalDeath,
      lifespan: canonicalBirth && canonicalDeath
        ? parseInt(canonicalDeath.slice(0, 4)) - parseInt(canonicalBirth.slice(0, 4))
        : null
    },
    stability: stability,
    created: new Date().toISOString()
  };
}

function buildTemporalEvents({ currentEvents, previousEvents, providerEvents, driftInfo, arbitrationDecisions }) {
  const events = [];

  for (const evt of currentEvents) {
    const driftRecord = driftInfo?.find(d => d.type === evt.type);
    const arbitrationRecord = arbitrationDecisions?.find(
      d => d.field === evt.type.toLowerCase() + "Date"
    );

    events.push({
      id: `event-${evt.type}-${evt.normalizedDate}`,
      type: evt.type,
      normalizedDate: evt.normalizedDate,
      precision: evt.precision,
      confidence: calculateEventConfidence(evt, providerEvents, arbitrationDecisions),
      drift: driftRecord ? {
        magnitude: driftRecord.driftMagnitude,
        previousValue: driftRecord.previous,
        currentValue: driftRecord.current
      } : null,
      arbitration: arbitrationRecord ? {
        winner: arbitrationRecord.winner,
        fsValue: arbitrationRecord.fsValue,
        challengerValue: arbitrationRecord.otherValue
      } : null,
      sources: {
        familysearch: evt,
        providers: collectProviderVersions(evt.type, providerEvents)
      }
    });
  }

  return events;
}

function buildProvenanceGraph({ personId, currentEvents, providers, arbitrationDecisions, stability }) {
  const layers = [];

  // Layer 1: Input Sources
  layers.push({
    layerId: 1,
    name: "INPUT_SOURCES",
    nodes: [
      { id: `source-fs`, label: "FamilySearch", type: "SOURCE" },
      ...Object.keys(providers).map(p => ({
        id: `source-${p}`,
        label: p,
        type: "PROVIDER"
      }))
    ]
  });

  // Layer 2: Extraction
  layers.push({
    layerId: 2,
    name: "EXTRACTION",
    nodes: currentEvents.map((e, i) => ({
      id: `extract-${i}`,
      label: `${e.type} [${e.normalizedDate}]`,
      type: "EVENT"
    }))
  });

  // Layer 3: Normalization
  layers.push({
    layerId: 3,
    name: "NORMALIZATION",
    nodes: currentEvents.map((e, i) => ({
      id: `norm-${i}`,
      label: `${e.type} normalized to ${e.normalizedDate}`,
      type: "NORMALIZED_EVENT"
    }))
  });

  // Layer 4: Precision Enhancement
  layers.push({
    layerId: 4,
    name: "PRECISION_ENHANCEMENT",
    nodes: currentEvents.map((e, i) => ({
      id: `prec-${i}`,
      label: `${e.type} [${e.precision}]`,
      type: "ENHANCED_EVENT"
    }))
  });

  // Layers 5-8: Parallel Processing Engines
  const engines = [
    { layerId: 5, name: "CONSISTENCY_CHECK" },
    { layerId: 6, name: "DRIFT_DETECTION" },
    { layerId: 7, name: "ARBITRATION" },
    { layerId: 8, name: "STABILITY_SCORING" }
  ];

  for (const engine of engines) {
    layers.push({
      layerId: engine.layerId,
      name: engine.name,
      nodes: [{
        id: `engine-${engine.name}`,
        label: engine.name,
        type: "ENGINE"
      }]
    });
  }

  // Layer 9: Reconstruction
  layers.push({
    layerId: 9,
    name: "RECONSTRUCTION",
    nodes: [
      { id: "recon-birth", label: "Birth Reconstruction", type: "INFERRED" },
      { id: "recon-death", label: "Death Reconstruction", type: "INFERRED" }
    ]
  });

  // Layer 10: Canonical Resolution
  layers.push({
    layerId: 10,
    name: "CANONICAL_RESOLUTION",
    nodes: [{
      id: `canonical-${personId}`,
      label: `Canonical Person ${personId}`,
      type: "CANONICAL"
    }]
  });

  // Layer 11: Confidence Synthesis
  layers.push({
    layerId: 11,
    name: "CONFIDENCE_SYNTHESIS",
    nodes: [{
      id: "conf-synth",
      label: `Composite Stability: ${stability.composite_stability}`,
      type: "CONFIDENCE"
    }]
  });

  // Layer 12: Temporal Indexing
  layers.push({
    layerId: 12,
    name: "TEMPORAL_INDEXING",
    nodes: [
      { id: "idx-birth", label: "Birth Index", type: "INDEX" },
      { id: "idx-death", label: "Death Index", type: "INDEX" }
    ]
  });

  // Layer 13: Final KG Write
  layers.push({
    layerId: 13,
    name: "KG_MATERIALIZATION",
    nodes: [{
      id: `kg-write-${personId}`,
      label: `KG Block for ${personId}`,
      type: "KG_MATERIALIZATION"
    }]
  });

  return {
    personId,
    totalLayers: 13,
    layers,
    created: new Date().toISOString()
  };
}

function buildConsistencyEdges({ personId, issues, reconstruction }) {
  const edges = [];

  for (const issue of issues ?? []) {
    edges.push({
      id: `consistency-${issue.type}`,
      type: "CONSISTENCY_VIOLATION",
      severity: issue.type === "REVERSED_LIFESPAN" ? "CRITICAL" : "MAJOR",
      violation: issue.type,
      details: issue,
      resolution: reconstruction ? "RECONSTRUCTED" : "UNRESOLVED"
    });
  }

  return edges;
}

function selectCanonicalValue(field, arbitrationDecisions, defaultValue) {
  const decision = arbitrationDecisions?.find(d => d.field === field);

  if (decision) {
    return decision.winner === "familysearch"
      ? decision.fsValue
      : decision.otherValue;
  }

  return defaultValue;
}

function calculateEventConfidence(event, providerEvents, arbitrationDecisions) {
  let confidence = 1.0;

  // Reduce confidence if precision is inferred
  if (event.precision === "INFERRED_DAY") confidence *= 0.85;
  if (event.precision === "MONTH") confidence *= 0.9;
  if (event.precision === "YEAR") confidence *= 0.7;

  // Reduce confidence if providers disagree
  if (providerEvents && Object.keys(providerEvents).length > 0) {
    let providerMatches = 0;
    const providerCount = Object.keys(providerEvents).length;

    for (const provider of Object.keys(providerEvents)) {
      const providerEvent = providerEvents[provider].find(e => e.type === event.type);
      if (providerEvent) {
        // Compare by year if precisions differ significantly
        const eventYear = event.normalizedDate.slice(0, 4);
        const providerYear = providerEvent.normalizedDate.slice(0, 4);

        if (eventYear === providerYear) {
          providerMatches++;
        }
      }
    }

    // Score based on year-level agreement
    confidence *= (0.5 + (providerMatches / providerCount) * 0.5);
  }

  return Math.round(confidence * 100) / 100;
}

function collectProviderVersions(eventType, providerEvents) {
  const versions = {};

  for (const [provider, events] of Object.entries(providerEvents || {})) {
    const providerEvent = events.find(e => e.type === eventType);
    if (providerEvent) {
      versions[provider] = {
        normalizedDate: providerEvent.normalizedDate,
        precision: providerEvent.precision
      };
    }
  }

  return versions;
}

function buildEventIndex(events) {
  const index = {};

  for (const evt of events) {
    if (!index[evt.type]) index[evt.type] = [];
    index[evt.type].push(evt.id);
  }

  return index;
}

function buildDateIndex(events) {
  const index = {};

  for (const evt of events) {
    const year = evt.normalizedDate.slice(0, 4);
    if (!index[year]) index[year] = [];
    index[year].push(evt.id);
  }

  return index;
}

function buildLayerIndex(provenanceGraph) {
  const index = {};

  for (const layer of provenanceGraph.layers) {
    index[layer.name] = layer.layerId;
  }

  return index;
}
