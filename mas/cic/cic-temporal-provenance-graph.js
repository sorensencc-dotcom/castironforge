// cic-temporal-provenance-graph.js — 2026-06-22 — v1.0.0
// CIC Temporal Provenance Graph Generator
// Produces graph-structured lineage of temporal values through the pipeline

export function generateProvenanceGraph(pipelineOutput, entityId) {
  const nodes = [];
  const edges = [];

  // Layer 1: Raw Provider Inputs
  const providers = Object.keys(pipelineOutput.providers || {});
  for (const p of providers) {
    nodes.push({ id: `provider_${p}`, label: p, layer: 1, type: "provider" });
    edges.push({ from: `provider_${p}`, to: "extractor", label: "raw events" });
  }

  if (pipelineOutput.previous?.enhanced) {
    nodes.push({ id: "fs_previous", label: "FamilySearch Previous", layer: 1, type: "provider" });
    edges.push({ from: "fs_previous", to: "extractor", label: "raw events" });
  }

  // Layer 2: Extraction
  nodes.push({ id: "extractor", label: "FS Temporal Extractor", layer: 2, type: "engine" });
  edges.push({ from: "extractor", to: "raw_events", label: "extracted" });

  // Layer 3: Raw Events
  nodes.push({ id: "raw_events", label: "Raw FS Events", layer: 3, type: "data" });
  edges.push({ from: "raw_events", to: "normalizer", label: "normalize" });

  // Layer 4: Normalizer
  nodes.push({ id: "normalizer", label: "KG Temporal Normalizer", layer: 4, type: "engine" });
  edges.push({ from: "normalizer", to: "normalized_events", label: "normalized" });

  // Layer 5: Normalized Events
  nodes.push({ id: "normalized_events", label: "Normalized Events", layer: 5, type: "data" });
  edges.push({ from: "normalized_events", to: "precision_enhancer", label: "enhance" });

  // Layer 6: Precision Enhancer
  nodes.push({ id: "precision_enhancer", label: "KG Temporal Precision Enhancer", layer: 6, type: "engine" });
  edges.push({ from: "precision_enhancer", to: "enhanced_events", label: "enhanced" });

  // Layer 7: Enhanced Events
  nodes.push({ id: "enhanced_events", label: "Enhanced Events", layer: 7, type: "data" });

  // Layer 8: Parallel Engines (Consistency, Drift, Arbitration, Stability)
  nodes.push({ id: "consistency", label: "KG Temporal Consistency Engine", layer: 8, type: "engine" });
  nodes.push({ id: "drift_detector", label: "KG Temporal Drift Detector", layer: 8, type: "engine" });
  nodes.push({ id: "arbitration", label: "Temporal Arbitration v2", layer: 8, type: "engine" });
  nodes.push({ id: "stability", label: "KG Temporal Stability Engine", layer: 8, type: "engine" });

  edges.push({ from: "enhanced_events", to: "consistency", label: "validate" });
  edges.push({ from: "enhanced_events", to: "drift_detector", label: "compare" });
  edges.push({ from: "enhanced_events", to: "arbitration", label: "arbitrate" });
  edges.push({ from: "enhanced_events", to: "stability", label: "evaluate" });

  // Layer 9: Engine Outputs
  nodes.push({ id: "consistency_report", label: "Consistency Issues", layer: 9, type: "data" });
  nodes.push({ id: "drift_report", label: "Drift Report", layer: 9, type: "data" });
  nodes.push({ id: "arbitrated_values", label: "Arbitrated Values", layer: 9, type: "data" });
  nodes.push({ id: "stability_vector", label: "Stability Vector", layer: 9, type: "data" });

  edges.push({ from: "consistency", to: "consistency_report", label: "output" });
  edges.push({ from: "drift_detector", to: "drift_report", label: "output" });
  edges.push({ from: "arbitration", to: "arbitrated_values", label: "output" });
  edges.push({ from: "stability", to: "stability_vector", label: "output" });

  // Layer 10: Reconstruction
  nodes.push({ id: "reconstruction", label: "Predictive Temporal Reconstruction Engine", layer: 10, type: "engine" });
  edges.push({ from: "arbitrated_values", to: "reconstruction", label: "fill gaps" });
  edges.push({ from: "enhanced_events", to: "reconstruction", label: "infer" });

  // Layer 11: Reconstructed Values
  nodes.push({ id: "reconstructed_values", label: "Reconstructed Values", layer: 11, type: "data" });
  edges.push({ from: "reconstruction", to: "reconstructed_values", label: "inferred" });

  // Layer 12: KG Write
  nodes.push({ id: "kg_write", label: "KG Write Adapter", layer: 12, type: "engine" });
  edges.push({ from: "arbitrated_values", to: "kg_write", label: "write" });
  edges.push({ from: "stability_vector", to: "kg_write", label: "annotate" });
  edges.push({ from: "consistency_report", to: "kg_write", label: "include" });
  edges.push({ from: "drift_report", to: "kg_write", label: "include" });
  edges.push({ from: "reconstructed_values", to: "kg_write", label: "merge" });

  // Layer 13: Final KG Block
  nodes.push({ id: "kg_block", label: "Final Temporal Block (KG)", layer: 13, type: "output" });
  edges.push({ from: "kg_write", to: "kg_block", label: "materialize" });

  return {
    entityId,
    timestamp: new Date().toISOString(),
    nodes,
    edges,
    stats: {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      layers: 13,
      engines: nodes.filter(n => n.type === "engine").length,
      dataPoints: nodes.filter(n => n.type === "data").length
    }
  };
}

/**
 * Compact graph representation for visualization
 */
export function compactProvenanceGraph(graph) {
  return `
Providers
   ↓
Extractor
   ↓
Normalizer
   ↓
Precision Enhancer
   ↓
 ┌──────────────┬──────────────┬──────────────┬──────────────┐
 │Consistency   │Drift Detector│Arbitration v2│Stability Eng │
 └──────┬───────┴──────┬───────┴──────┬───────┴──────┬───────┘
        ↓              ↓              ↓              ↓
     Consistency   Drift Report   Arbitrated   Stability
     Report                       Values       Vector
        └──────────────┬────────────────┬──────────────┘
                       ↓                ↓
                  Reconstruction Engine
                       ↓
                Reconstructed Values
                       ↓
                   KG Write
                       ↓
              Final Temporal Block (KG)
  `;
}
