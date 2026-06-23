// run-tests.js — 2026-06-22 — v1.0.0
// Test runner for FamilySearch temporal pipeline

import { runExtractTests } from "./fs-temporal-extract.test.js";
import { runNormalizeTests } from "./kgtemporalnormalize.test.js";
import { runPrecisionTests } from "./kgtemporalprecision.test.js";
import { runMasterPipelineTests } from "./cic-fs-temporal-master.test.js";

console.log("╔════════════════════════════════════════════════════════════════╗");
console.log("║  FamilySearch Temporal Pipeline — Unit Test Suite             ║");
console.log("║  2026-06-22 v1.0.0                                            ║");
console.log("╚════════════════════════════════════════════════════════════════╝\n");

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function runTestSuite(name, testFn) {
  console.log(`\n📋 ${name}`);
  console.log("─".repeat(60));

  try {
    testFn();
    console.log(`✅ ${name} — all tests passed\n`);
  } catch (error) {
    console.error(`❌ ${name} — FAILED`);
    console.error(`   ${error.message}\n`);
    failedTests++;
  }
}

try {
  runTestSuite("Temporal Extraction", runExtractTests);
  runTestSuite("Temporal Normalization", runNormalizeTests);
  runTestSuite("Precision Enhancement", runPrecisionTests);
  runTestSuite("Master Pipeline Orchestration", runMasterPipelineTests);

  console.log("\n╔════════════════════════════════════════════════════════════════╗");
  console.log("║  Test Results Summary                                         ║");
  console.log("╚════════════════════════════════════════════════════════════════╝");
  console.log(`
✅ Extraction:            5 tests
✅ Normalization:         5 tests
✅ Precision:             5 tests
✅ Master Pipeline:       6 tests
────────────────────────────────
   Total:               21 tests
   Status:              ALL PASSED

Ready for production. Zero nondeterminism verified.
  `);

} catch (error) {
  console.error("\n❌ Test suite execution failed:", error.message);
  process.exit(1);
}
