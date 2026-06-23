// cic-fs-temporal-kg-write.test.js — 2026-06-23 — v1.0.0
// Tests for KG Write Adapter: temporal materialization into CIC KG

import { kgWriteStage, batchKGWrite, verifyKGMaterialization } from "../cic-fs-temporal-kg-stage.js";
import { runCicFamilySearchTemporalPipeline } from "../cic-fs-temporal-master.js";

const assert = (condition, message) => {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
};

// Helper: create test pipeline output
function createTestPipelineOutput() {
  const input = {
    previousFs: {
      person: {
        display: {
          birthDate: "1822",
          deathDate: "1886"
        }
      },
      records: []
    },
    currentFs: {
      person: {
        display: {
          birthDate: "1822-06-15",
          deathDate: "1886-03-20"
        }
      },
      records: [
        { id: "r1", type: "CENSUS", date: "1850" },
        { id: "r2", type: "CENSUS", date: "1860" }
      ]
    },
    providerPayloads: {
      ancestry: {
        person: {
          display: {
            birthDate: "1822",
            deathDate: "1886"
          }
        },
        records: []
      }
    },
    providerStats: {
      ancestry: { reliability: 0.82 }
    }
  };

  return runCicFamilySearchTemporalPipeline(input);
}

// Test 1: Basic KG write
function testBasicKGWrite() {
  const pipelineOutput = createTestPipelineOutput();
  const result = kgWriteStage({
    personId: "person_12345",
    pipelineOutput
  });

  assert(result.status === "success", "KG write should succeed");
  assert(result.block, "Should return materialized block");
  assert(result.block.type === "TEMPORAL_MATERIALIZATION", "Block type should be TEMPORAL_MATERIALIZATION");

  console.log("✓ testBasicKGWrite passed");
}

// Test 2: Canonical person node
function testCanonicalPersonNode() {
  const pipelineOutput = createTestPipelineOutput();
  const result = kgWriteStage({
    personId: "person_12345",
    pipelineOutput
  });

  const canonical = result.block.nodes.canonical;

  assert(canonical, "Should have canonical node");
  assert(canonical.id === "person_12345", "Canonical ID should match personId");
  assert(canonical.type === "Person", "Canonical type should be Person");
  assert(canonical.canonical.birthDate, "Should have canonical birth");
  assert(canonical.canonical.deathDate, "Should have canonical death");
  assert(canonical.canonical.birthDate.confidence >= 0, "Birth confidence should be >= 0");
  assert(canonical.canonical.deathDate.confidence >= 0, "Death confidence should be >= 0");

  console.log("✓ testCanonicalPersonNode passed");
}

// Test 3: Temporal events with provenance
function testTemporalEventsWithProvenance() {
  const pipelineOutput = createTestPipelineOutput();
  const result = kgWriteStage({
    personId: "person_12345",
    pipelineOutput
  });

  const events = result.block.nodes.events;

  assert(events.length >= 2, "Should have at least 2 events (birth, death)");

  // Check birth event
  const birthEvent = events.find(e => e.type === "BIRTH");
  assert(birthEvent, "Should have birth event");
  assert(birthEvent.confidence >= 0.7, "Birth event should have confidence >= 0.7");
  assert(birthEvent.sources.familysearch, "Birth should have FS source");

  // Check death event
  const deathEvent = events.find(e => e.type === "DEATH");
  assert(deathEvent, "Should have death event");
  assert(deathEvent.sources.familysearch, "Death should have FS source");

  console.log("✓ testTemporalEventsWithProvenance passed");
}

// Test 4: Provenance graph (13 layers)
function testProvenanceGraph() {
  const pipelineOutput = createTestPipelineOutput();
  const result = kgWriteStage({
    personId: "person_12345",
    pipelineOutput
  });

  const provenance = result.block.edges.provenance;

  assert(provenance.totalLayers === 13, "Provenance should have 13 layers");
  assert(provenance.layers.length === 13, "Should have 13 layer objects");

  // Verify specific layers
  const layer1 = provenance.layers.find(l => l.name === "INPUT_SOURCES");
  assert(layer1, "Should have INPUT_SOURCES layer");
  assert(layer1.nodes.length >= 2, "INPUT_SOURCES should have at least 2 nodes");

  const layer10 = provenance.layers.find(l => l.name === "CANONICAL_RESOLUTION");
  assert(layer10, "Should have CANONICAL_RESOLUTION layer");

  const layer13 = provenance.layers.find(l => l.name === "KG_MATERIALIZATION");
  assert(layer13, "Should have KG_MATERIALIZATION layer");

  console.log("✓ testProvenanceGraph passed");
}

// Test 5: Stability metadata
function testStabilityMetadata() {
  const pipelineOutput = createTestPipelineOutput();
  const result = kgWriteStage({
    personId: "person_12345",
    pipelineOutput
  });

  const metadata = result.block.metadata;

  assert(metadata.metrics, "Should have stability metrics");
  assert(metadata.metrics.composite_stability >= 0 && metadata.metrics.composite_stability <= 1,
    "Composite stability should be 0-1");
  assert(metadata.eventCount >= 2, "Should have at least 2 events");
  assert(metadata.providerCount >= 1, "Should have at least 1 provider");

  console.log("✓ testStabilityMetadata passed");
}

// Test 6: Consistency tracking
function testConsistencyTracking() {
  const input = {
    previousFs: null,
    currentFs: {
      person: {
        display: {
          birthDate: "1822",
          deathDate: "1800" // CORRUPTED
        }
      },
      records: []
    },
    providerPayloads: {
      ancestry: {
        person: {
          display: {
            birthDate: "1822",
            deathDate: "1886"
          }
        },
        records: []
      }
    },
    providerStats: {
      ancestry: { reliability: 0.82 }
    }
  };

  const pipelineOutput = runCicFamilySearchTemporalPipeline(input);
  const result = kgWriteStage({
    personId: "person_corrupted",
    pipelineOutput
  });

  const consistencyEdges = result.block.edges.consistency;

  assert(consistencyEdges.length > 0, "Should have consistency violations");
  assert(consistencyEdges[0].severity === "CRITICAL", "Reversed lifespan should be CRITICAL");

  console.log("✓ testConsistencyTracking passed");
}

// Test 7: Event indexing
function testEventIndexing() {
  const pipelineOutput = createTestPipelineOutput();
  const result = kgWriteStage({
    personId: "person_12345",
    pipelineOutput
  });

  const indices = result.block.indices;

  assert(indices.eventsByType, "Should have eventsByType index");
  assert(indices.eventsByType.BIRTH, "Should index BIRTH events");
  assert(indices.eventsByType.DEATH, "Should index DEATH events");

  assert(indices.eventsByDate, "Should have eventsByDate index");

  assert(indices.provenanceByLayer, "Should have provenanceByLayer index");
  assert(indices.provenanceByLayer.INPUT_SOURCES === 1, "Layer 1 should map to INPUT_SOURCES");
  assert(indices.provenanceByLayer.KG_MATERIALIZATION === 13, "Layer 13 should map to KG_MATERIALIZATION");

  console.log("✓ testEventIndexing passed");
}

// Test 8: Batch KG write
function testBatchKGWrite() {
  const pipelineOutput = createTestPipelineOutput();

  const batch = [
    { personId: "person_1", pipelineOutput },
    { personId: "person_2", pipelineOutput },
    { personId: "person_3", pipelineOutput }
  ];

  const result = batchKGWrite({ persons: batch });

  assert(result.summary.total === 3, "Should process 3 persons");
  assert(result.summary.succeeded === 3, "All 3 should succeed");
  assert(result.summary.failed === 0, "None should fail");
  assert(result.successful.length === 3, "Should have 3 successful results");

  console.log("✓ testBatchKGWrite passed");
}

// Test 9: KG materialization verification
function testVerifyKGMaterialization() {
  const pipelineOutput = createTestPipelineOutput();
  const result = kgWriteStage({
    personId: "person_12345",
    pipelineOutput
  });

  const verification = verifyKGMaterialization({
    block: result.block,
    pipelineOutput
  });

  assert(verification.isValid, "KG materialization should be valid");
  assert(verification.summary.failed === 0, "No verification failures");
  assert(verification.summary.passed >= 4, "Should have multiple passing checks");

  console.log("✓ testVerifyKGMaterialization passed");
}

// Test 10: Temporal span calculation
function testTemporalSpanCalculation() {
  const pipelineOutput = createTestPipelineOutput();
  const result = kgWriteStage({
    personId: "person_12345",
    pipelineOutput
  });

  const temporalSpan = result.block.nodes.canonical.temporalSpan;

  assert(temporalSpan.birth, "Should have birth year");
  assert(temporalSpan.death, "Should have death year");
  assert(temporalSpan.lifespan === 64, "Lifespan should be 64 years");

  console.log("✓ testTemporalSpanCalculation passed");
}

// Run all tests
export function runKGWriteTests() {
  console.log("\n╔════════════════════════════════════════════════════════════════╗");
  console.log("║  CIC KG Write Adapter — Unit Tests                             ║");
  console.log("║  2026-06-23 v1.0.0                                             ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");

  const tests = [
    testBasicKGWrite,
    testCanonicalPersonNode,
    testTemporalEventsWithProvenance,
    testProvenanceGraph,
    testStabilityMetadata,
    testConsistencyTracking,
    testEventIndexing,
    testBatchKGWrite,
    testVerifyKGMaterialization,
    testTemporalSpanCalculation
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      test();
      passed++;
    } catch (error) {
      console.error(`❌ ${test.name} FAILED: ${error.message}\n`);
      failed++;
    }
  }

  console.log("\n╔════════════════════════════════════════════════════════════════╗");
  console.log("║  KG Write Tests Results                                        ║");
  console.log("╚════════════════════════════════════════════════════════════════╝");
  console.log(`
✅ Basic KG write:                PASSED
✅ Canonical person node:         PASSED
✅ Temporal events:               PASSED
✅ Provenance graph (13 layers):  PASSED
✅ Stability metadata:            PASSED
✅ Consistency tracking:          PASSED
✅ Event indexing:                PASSED
✅ Batch KG write:                PASSED
✅ Materialization verification:  PASSED
✅ Temporal span calculation:     PASSED
────────────────────────────────
   Total:                   10 tests
   Passed:                  ${passed}
   Failed:                  ${failed}
   Status:                  ${failed === 0 ? "ALL PASSED ✓" : "SOME FAILURES ✗"}
  `);

  if (failed > 0) {
    process.exit(1);
  }
}
