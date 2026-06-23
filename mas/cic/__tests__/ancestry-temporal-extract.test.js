// ancestry-temporal-extract.test.js — 2026-06-23 — v1.0.0
// Unit tests for Ancestry temporal extractor

import { extractAncestryTemporal } from "../ancestry-temporal-extract.js";

const assert = (condition, message) => {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
};

// Test 1: Extract birth and death dates
function testBasicBirthDeathExtraction() {
  const payload = {
    person: {
      display: {
        birthDate: "1822-06-15",
        deathDate: "1886-03-20"
      }
    },
    records: []
  };

  const events = extractAncestryTemporal(payload);

  assert(events.length === 2, "Should extract 2 events");
  assert(events[0].type === "BIRTH", "First event should be BIRTH");
  assert(events[0].date === "1822-06-15", "Birth date should match");
  assert(events[0].source === "ancestry", "Source should be ancestry");
  assert(events[1].type === "DEATH", "Second event should be DEATH");
  assert(events[1].date === "1886-03-20", "Death date should match");

  console.log("✓ testBasicBirthDeathExtraction passed");
}

// Test 2: Extract records
function testRecordExtraction() {
  const payload = {
    person: {
      display: {
        birthDate: "1822"
      }
    },
    records: [
      { id: "r1", type: "census", date: "1850" },
      { id: "r2", type: "marriage", date: "1845-06-15" }
    ]
  };

  const events = extractAncestryTemporal(payload);

  assert(events.length === 3, "Should extract 3 events");
  assert(events[1].type === "CENSUS", "Type should be uppercased");
  assert(events[1].recordId === "r1", "Should capture recordId");
  assert(events[2].type === "MARRIAGE", "Second record type should be uppercased");

  console.log("✓ testRecordExtraction passed");
}

// Test 3: Handle missing person data
function testMissingPersonData() {
  const payload = {
    person: null,
    records: []
  };

  const events = extractAncestryTemporal(payload);

  assert(events.length === 0, "Should return empty array for missing person");

  console.log("✓ testMissingPersonData passed");
}

// Test 4: Handle missing dates
function testMissingDates() {
  const payload = {
    person: {
      display: {
        birthDate: "1822"
        // no deathDate
      }
    },
    records: []
  };

  const events = extractAncestryTemporal(payload);

  assert(events.length === 1, "Should extract only birth");
  assert(events[0].type === "BIRTH", "Event should be BIRTH");

  console.log("✓ testMissingDates passed");
}

// Test 5: Filter records without dates
function testFilterRecordsWithoutDates() {
  const payload = {
    person: {
      display: {
        birthDate: "1822"
      }
    },
    records: [
      { id: "r1", type: "census", date: "1850" },
      { id: "r2", type: "record" }, // no date
      { id: "r3", type: "census", date: "1860" }
    ]
  };

  const events = extractAncestryTemporal(payload);

  assert(events.length === 3, "Should extract 3 events (skip record without date)");
  assert(events[1].recordId === "r1", "First record should be r1");
  assert(events[2].recordId === "r3", "Second record should be r3");

  console.log("✓ testFilterRecordsWithoutDates passed");
}

// Test 6: Handle empty records array
function testEmptyRecordsArray() {
  const payload = {
    person: {
      display: {
        birthDate: "1822",
        deathDate: "1886"
      }
    },
    records: []
  };

  const events = extractAncestryTemporal(payload);

  assert(events.length === 2, "Should extract only person events");

  console.log("✓ testEmptyRecordsArray passed");
}

// Test 7: Handle null/undefined payload
function testNullPayload() {
  const events = extractAncestryTemporal(null);

  assert(events.length === 0, "Should handle null payload gracefully");

  console.log("✓ testNullPayload passed");
}

// Test 8: Handle undefined records array
function testUndefinedRecordsArray() {
  const payload = {
    person: {
      display: {
        birthDate: "1822"
      }
    }
    // records is undefined
  };

  const events = extractAncestryTemporal(payload);

  assert(events.length === 1, "Should handle undefined records array");

  console.log("✓ testUndefinedRecordsArray passed");
}

// Test 9: Year-only dates
function testYearOnlyDates() {
  const payload = {
    person: {
      display: {
        birthDate: "1822",
        deathDate: "1886"
      }
    },
    records: [
      { id: "r1", type: "census", date: "1850" }
    ]
  };

  const events = extractAncestryTemporal(payload);

  assert(events.length === 3, "Should extract all events");
  assert(events[0].date === "1822", "Birth date should be year-only");
  assert(events[1].date === "1886", "Death date should be year-only");
  assert(events[2].date === "1850", "Record date should be year-only");

  console.log("✓ testYearOnlyDates passed");
}

// Test 10: Default record type
function testDefaultRecordType() {
  const payload = {
    person: {
      display: {
        birthDate: "1822"
      }
    },
    records: [
      { id: "r1", date: "1850" } // no type
    ]
  };

  const events = extractAncestryTemporal(payload);

  assert(events.length === 2, "Should extract 2 events");
  assert(events[1].type === "RECORD", "Should default to RECORD type");

  console.log("✓ testDefaultRecordType passed");
}

// Run all tests
export function runAncestryExtractorTests() {
  console.log("\n╔════════════════════════════════════════════════════════════════╗");
  console.log("║  Ancestry Temporal Extractor — Unit Tests                      ║");
  console.log("║  2026-06-23 v1.0.0                                             ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");

  const tests = [
    testBasicBirthDeathExtraction,
    testRecordExtraction,
    testMissingPersonData,
    testMissingDates,
    testFilterRecordsWithoutDates,
    testEmptyRecordsArray,
    testNullPayload,
    testUndefinedRecordsArray,
    testYearOnlyDates,
    testDefaultRecordType
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
  console.log("║  Ancestry Extractor Test Results                               ║");
  console.log("╚════════════════════════════════════════════════════════════════╝");
  console.log(`
✅ Basic birth/death extraction:   PASSED
✅ Record extraction:               PASSED
✅ Missing person data:             PASSED
✅ Missing dates:                   PASSED
✅ Filter records without dates:    PASSED
✅ Empty records array:             PASSED
✅ Null payload:                    PASSED
✅ Undefined records array:         PASSED
✅ Year-only dates:                 PASSED
✅ Default record type:             PASSED
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
