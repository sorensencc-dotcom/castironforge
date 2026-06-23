// cic-fs-temporal-master.test.js — 2026-06-22 — v1.0.0

import { runCicFamilySearchTemporalPipeline } from "../cic-fs-temporal-master.js";

const assert = (condition, message) => {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
};

// Test 1: Complete pipeline execution with all stages
function testCompletePipelineExecution() {
  const input = {
    previousFs: {
      person: {
        display: {
          birthDate: "1822",
          deathDate: "1874"
        }
      },
      records: []
    },
    currentFs: {
      person: {
        display: {
          birthDate: "1822-06-15",
          deathDate: "1886"
        }
      },
      records: [
        { id: "r1", type: "CENSUS", date: "1850" }
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

  const result = runCicFamilySearchTemporalPipeline(input);

  assert(result.current, "Should have current stage output");
  assert(result.current.enhanced, "Should have enhanced events");
  assert(result.previous, "Should have previous stage output");
  assert(result.providers, "Should have provider events");
  assert(result.consistency, "Should have consistency check");
  assert(result.drift, "Should have drift detection");
  assert(result.arbitration, "Should have arbitration decisions");
  assert(result.stability, "Should have stability metrics");
  assert(result.reconstruction, "Should have reconstruction");

  console.log("✓ testCompletePipelineExecution passed");
}

// Test 2: Drift detection between previous and current
function testDriftDetection() {
  const input = {
    previousFs: {
      person: { display: { birthDate: "1822", deathDate: "1874" } },
      records: []
    },
    currentFs: {
      person: { display: { birthDate: "1822-06-15", deathDate: "1886" } },
      records: []
    },
    providerPayloads: {},
    providerStats: {}
  };

  const result = runCicFamilySearchTemporalPipeline(input);

  assert(result.drift, "Should have drift object");
  assert(result.drift !== null, "Drift should not be null");

  console.log("✓ testDriftDetection passed");
}

// Test 3: Multi-provider arbitration
function testMultiProviderArbitration() {
  const input = {
    previousFs: null,
    currentFs: {
      person: { display: { birthDate: "1822", deathDate: "1886" } },
      records: []
    },
    providerPayloads: {
      ancestry: {
        person: { display: { birthDate: "1822", deathDate: "1886" } },
        records: []
      },
      myheritage: {
        person: { display: { birthDate: "1821", deathDate: "1884" } },
        records: []
      }
    },
    providerStats: {
      ancestry: { reliability: 0.82 },
      myheritage: { reliability: 0.65 }
    }
  };

  const result = runCicFamilySearchTemporalPipeline(input);

  assert(result.arbitration, "Should have arbitration decisions");
  assert(result.providers.ancestry, "Should process Ancestry provider");
  assert(result.providers.myheritage, "Should process MyHeritage provider");

  console.log("✓ testMultiProviderArbitration passed");
}

// Test 4: Stability scoring
function testStabilityScoring() {
  const input = {
    previousFs: {
      person: { display: { birthDate: "1822", deathDate: "1886" } },
      records: []
    },
    currentFs: {
      person: { display: { birthDate: "1822-06-15", deathDate: "1886" } },
      records: []
    },
    providerPayloads: {
      ancestry: {
        person: { display: { birthDate: "1822", deathDate: "1886" } },
        records: []
      }
    },
    providerStats: {
      ancestry: { reliability: 0.82 }
    }
  };

  const result = runCicFamilySearchTemporalPipeline(input);

  assert(result.stability, "Should compute stability");
  assert(result.stability.metrics, "Should have stability metrics");

  console.log("✓ testStabilityScoring passed");
}

// Test 5: Reconstruction of missing dates
function testReconstructionOfMissingDates() {
  const input = {
    previousFs: null,
    currentFs: {
      person: { display: { birthDate: "1822", deathDate: null } },
      records: []
    },
    providerPayloads: {},
    providerStats: {}
  };

  const result = runCicFamilySearchTemporalPipeline(input);

  assert(result.reconstruction, "Should have reconstruction");
  assert(result.reconstruction.death, "Should reconstruct missing death");

  console.log("✓ testReconstructionOfMissingDates passed");
}

// Test 6: Handle null previous snapshot
function testHandleNullPreviousSnapshot() {
  const input = {
    previousFs: null,
    currentFs: {
      person: { display: { birthDate: "1822" } },
      records: []
    },
    providerPayloads: {},
    providerStats: {}
  };

  const result = runCicFamilySearchTemporalPipeline(input);

  assert(result.previous, "Should handle null previous snapshot");
  assert(result.previous.enhanced !== undefined, "Should have enhanced previous");

  console.log("✓ testHandleNullPreviousSnapshot passed");
}

// Run all tests
export function runMasterPipelineTests() {
  testCompletePipelineExecution();
  testDriftDetection();
  testMultiProviderArbitration();
  testStabilityScoring();
  testReconstructionOfMissingDates();
  testHandleNullPreviousSnapshot();
  console.log("All master pipeline tests passed!\n");
}
