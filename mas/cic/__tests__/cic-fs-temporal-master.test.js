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

// Test 7: Ancestry provider integration
function testAncestryProviderIntegration() {
  const input = {
    previousFs: null,
    currentFs: {
      person: { display: { birthDate: "1822-06-15", deathDate: "1886-03-20" } },
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
        records: [
          { id: "anc-1", type: "CENSUS", date: "1850" },
          { id: "anc-2", type: "CENSUS", date: "1860" }
        ]
      }
    },
    providerStats: {
      ancestry: { reliability: 0.82 }
    }
  };

  const result = runCicFamilySearchTemporalPipeline(input);

  assert(result.providers.ancestry, "Should process Ancestry provider");
  assert(result.providers.ancestry.length >= 2, "Should extract Ancestry events");

  const ancestryBirth = result.providers.ancestry.find(e => e.type === "BIRTH");
  assert(ancestryBirth, "Should extract Ancestry birth event");
  assert(ancestryBirth.source === "ancestry", "Source should be ancestry");

  console.log("✓ testAncestryProviderIntegration passed");
}

// Test 8: WikiData provider integration
function testWikiDataProviderIntegration() {
  const input = {
    previousFs: null,
    currentFs: {
      person: { display: { birthDate: "1822-06-15", deathDate: "1886-03-20" } },
      records: []
    },
    providerPayloads: {
      wikidata: {
        person: {
          birthDate: { value: "1822-06-15", precision: 8 },
          deathDate: { value: "1886-03-20", precision: 8 }
        },
        events: []
      }
    },
    providerStats: {
      wikidata: { reliability: 0.88 }
    }
  };

  const result = runCicFamilySearchTemporalPipeline(input);

  assert(result.providers.wikidata, "Should process WikiData provider");
  assert(result.providers.wikidata.length >= 2, "Should extract WikiData events");

  const wikiDataBirth = result.providers.wikidata.find(e => e.type === "BIRTH");
  assert(wikiDataBirth, "Should extract WikiData birth event");
  assert(wikiDataBirth.source === "wikidata", "Source should be wikidata");

  console.log("✓ testWikiDataProviderIntegration passed");
}

// Test 9: All three providers together
function testMultiProviderWithAncestryAndWikiData() {
  const input = {
    previousFs: null,
    currentFs: {
      person: { display: { birthDate: "1822-06-15", deathDate: "1886-03-20" } },
      records: []
    },
    providerPayloads: {
      ancestry: {
        person: { display: { birthDate: "1822", deathDate: "1886" } },
        records: []
      },
      wikidata: {
        person: {
          birthDate: { value: "1822-06-15", precision: 8 },
          deathDate: { value: "1886-03-20", precision: 8 }
        },
        events: []
      }
    },
    providerStats: {
      ancestry: { reliability: 0.82 },
      wikidata: { reliability: 0.88 }
    }
  };

  const result = runCicFamilySearchTemporalPipeline(input);

  assert(result.providers.ancestry, "Should process Ancestry");
  assert(result.providers.wikidata, "Should process WikiData");
  assert(result.arbitration, "Should perform arbitration across all 3 providers");

  const providerCount = Object.keys(result.providers).length;
  assert(providerCount === 2, "Should have 2 providers");

  console.log("✓ testMultiProviderWithAncestryAndWikiData passed");
}

// Test 10: Arbitration with conflicting dates across Ancestry and WikiData
function testArbitrationWithAncestryAndWikiData() {
  const input = {
    previousFs: null,
    currentFs: {
      person: { display: { birthDate: "1822-06-15", deathDate: "1886-03-20" } },
      records: []
    },
    providerPayloads: {
      ancestry: {
        person: { display: { birthDate: "1821", deathDate: "1886" } },
        records: []
      },
      wikidata: {
        person: {
          birthDate: { value: "1823", precision: 6 },
          deathDate: { value: "1886", precision: 6 }
        },
        events: []
      }
    },
    providerStats: {
      ancestry: { reliability: 0.82 },
      wikidata: { reliability: 0.88 }
    }
  };

  const result = runCicFamilySearchTemporalPipeline(input);

  assert(result.arbitration, "Should perform arbitration");
  assert(result.arbitration.decisions, "Should have arbitration decisions");

  // Verify that FamilySearch event was normalized and compared
  assert(result.current.enhanced, "Should have current enhanced events");
  assert(result.current.enhanced.some(e => e.type === "BIRTH"), "Should have birth event");

  console.log("✓ testArbitrationWithAncestryAndWikiData passed");
}

// Run all tests
export function runMasterPipelineTests() {
  testCompletePipelineExecution();
  testDriftDetection();
  testMultiProviderArbitration();
  testStabilityScoring();
  testReconstructionOfMissingDates();
  testHandleNullPreviousSnapshot();
  testAncestryProviderIntegration();
  testWikiDataProviderIntegration();
  testMultiProviderWithAncestryAndWikiData();
  testArbitrationWithAncestryAndWikiData();
  console.log("All master pipeline tests passed!\n");
}
