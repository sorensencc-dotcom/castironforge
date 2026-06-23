// cic-fs-temporal-kg-stage.js — 2026-06-23 — v1.0.0
// CIC Pipeline Hook: KG Write Stage for temporal materialization

import { writeFamilySearchTemporalToKG } from "./cic-fs-temporal-kg-write.js";

/**
 * CIC Pipeline Hook: kg.write stage
 *
 * Materializes temporal pipeline output into the CIC Knowledge Graph.
 * This is the final sink stage that persists cleaned, arbitrated temporal data.
 */
export function kgWriteStage({ personId, pipelineOutput, options = {} }) {
  if (!personId || !pipelineOutput) {
    return {
      status: "error",
      message: "Missing personId or pipelineOutput",
      block: null
    };
  }

  try {
    // Write to KG
    const result = writeFamilySearchTemporalToKG({
      personId,
      pipelineOutput
    });

    // Return materialized block with metadata
    return {
      status: "success",
      personId,
      block: result.block,
      metadata: {
        writtenAt: new Date().toISOString(),
        temporalSpan: {
          birth: result.block.nodes.canonical.temporalSpan.birth,
          death: result.block.nodes.canonical.temporalSpan.death,
          lifespan: result.block.nodes.canonical.temporalSpan.lifespan
        },
        eventCount: result.block.nodes.events.length,
        stabilityScore: result.block.metadata.metrics.composite_stability,
        hasInconsistencies: result.block.edges.consistency.length > 0,
        hasReconstruction: Object.values(result.block.metadata.reconstructionFlags.inferred).some(v => v)
      }
    };
  } catch (error) {
    return {
      status: "error",
      message: error.message,
      block: null,
      error: {
        name: error.name,
        stack: error.stack
      }
    };
  }
}

/**
 * Batch KG write for multiple persons
 */
export function batchKGWrite({ persons, options = {} }) {
  const results = {
    successful: [],
    failed: [],
    summary: {
      total: persons.length,
      succeeded: 0,
      failed: 0,
      averageStability: 0
    }
  };

  const stabilityScores = [];

  for (const person of persons) {
    const result = kgWriteStage({
      personId: person.personId,
      pipelineOutput: person.pipelineOutput,
      options
    });

    if (result.status === "success") {
      results.successful.push(result);
      results.summary.succeeded++;
      if (result.block.metadata.metrics.composite_stability) {
        stabilityScores.push(result.block.metadata.metrics.composite_stability);
      }
    } else {
      results.failed.push({
        personId: person.personId,
        error: result.message
      });
      results.summary.failed++;
    }
  }

  if (stabilityScores.length > 0) {
    results.summary.averageStability =
      stabilityScores.reduce((a, b) => a + b) / stabilityScores.length;
  }

  return results;
}

/**
 * Verify KG materialization against temporal pipeline
 */
export function verifyKGMaterialization({ block, pipelineOutput }) {
  const verification = {
    passed: [],
    failed: [],
    warnings: []
  };

  // Verify canonical person node exists
  if (!block.nodes.canonical) {
    verification.failed.push("Missing canonical person node");
  } else {
    verification.passed.push("Canonical person node present");
  }

  // Verify event count matches
  const expectedEventCount = pipelineOutput.current.enhanced.length;
  const actualEventCount = block.nodes.events.length;

  if (expectedEventCount === actualEventCount) {
    verification.passed.push(`Event count matches (${actualEventCount})`);
  } else {
    verification.warnings.push(
      `Event count mismatch: expected ${expectedEventCount}, got ${actualEventCount}`
    );
  }

  // Verify provenance graph has all 13 layers
  if (block.edges.provenance.totalLayers === 13) {
    verification.passed.push("Provenance graph has all 13 layers");
  } else {
    verification.failed.push(
      `Provenance graph missing layers: expected 13, got ${block.edges.provenance.totalLayers}`
    );
  }

  // Verify stability metrics are populated
  if (block.metadata.metrics && block.metadata.metrics.composite_stability > 0) {
    verification.passed.push(`Stability score: ${block.metadata.metrics.composite_stability}`);
  } else {
    verification.warnings.push("Stability metrics missing or zero");
  }

  // Verify consistency violations are tracked
  if (pipelineOutput.consistency.issues.length > 0) {
    if (block.edges.consistency.length > 0) {
      verification.passed.push(
        `Consistency violations tracked (${block.edges.consistency.length})`
      );
    } else {
      verification.failed.push("Consistency violations detected but not materialized");
    }
  }

  const isValid = verification.failed.length === 0;

  return {
    isValid,
    summary: {
      passed: verification.passed.length,
      failed: verification.failed.length,
      warnings: verification.warnings.length
    },
    details: verification
  };
}
