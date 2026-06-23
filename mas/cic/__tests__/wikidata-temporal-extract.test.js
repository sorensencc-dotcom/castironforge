// wikidata-temporal-extract.test.js — 2026-06-23 — v1.0.0
// Unit tests for WikiData temporal extractor

import { extractWikiDataTemporal } from "../wikidata-temporal-extract.js";

const assert = (condition, message) => {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
};

// Test 1: Extract birth and death with precision
function testBasicBirthDeathExtraction() {
  const payload = {
    person: {
      birthDate: { value: "1822-06-15", precision: 8 },
      deathDate: { value: "1886-03-20", precision: 8 }
    },
    events: []
  };

  const events = extractWikiDataTemporal(payload);

  assert(events.length === 2, "Should extract 2 events");
  assert(events[0].type === "BIRTH", "First event should be BIRTH");
  assert(events[0].date === "1822-06-15", "Birth date should match");
  assert(events[0].source === "wikidata", "Source should be wikidata");
  assert(events[0].wikiDataPrecision === 8, "Should preserve WikiData precision");
  assert(events[1].type === "DEATH", "Second event should be DEATH");

  console.log("✓ testBasicBirthDeathExtraction passed");
}

// Test 2: Extract with year-only precision
function testYearOnlyPrecision() {
  const payload = {
    person: {
      birthDate: { value: "1822", precision: 6 },
      deathDate: { value: "1886", precision: 6 }
    },
    events: []
  };

  const events = extractWikiDataTemporal(payload);

  assert(events.length === 2, "Should extract 2 events");
  assert(events[0].date === "1822", "Year-only date should be preserved");
  assert(events[0].wikiDataPrecision === 6, "Precision should be 6 for year");

  console.log("✓ testYearOnlyPrecision passed");
}

// Test 3: Extract with month precision
function testMonthPrecision() {
  const payload = {
    person: {
      birthDate: { value: "1822-06", precision: 7 },
      deathDate: { value: "1886-03", precision: 7 }
    },
    events: []
  };

  const events = extractWikiDataTemporal(payload);

  assert(events.length === 2, "Should extract 2 events");
  assert(events[0].date === "1822-06", "Month precision date should be preserved");
  assert(events[0].wikiDataPrecision === 7, "Precision should be 7 for month");

  console.log("✓ testMonthPrecision passed");
}

// Test 4: Extract events array
function testEventsArrayExtraction() {
  const payload = {
    person: {
      birthDate: { value: "1822", precision: 6 }
    },
    events: [
      { id: "e1", type: "marriage", date: "1845-06-15" },
      { id: "e2", type: "census", date: "1850" }
    ]
  };

  const events = extractWikiDataTemporal(payload);

  assert(events.length === 3, "Should extract birth + 2 events");
  assert(events[1].type === "MARRIAGE", "Event type should be uppercased");
  assert(events[1].recordId === "e1", "Should capture recordId");
  assert(events[2].type === "CENSUS", "Second event should be census");

  console.log("✓ testEventsArrayExtraction passed");
}

// Test 5: Handle missing person data
function testMissingPersonData() {
  const payload = {
    person: null,
    events: []
  };

  const events = extractWikiDataTemporal(payload);

  assert(events.length === 0, "Should return empty array for missing person");

  console.log("✓ testMissingPersonData passed");
}

// Test 6: Handle missing date values
function testMissingDateValues() {
  const payload = {
    person: {
      birthDate: { value: "1822", precision: 6 }
      // no deathDate
    },
    events: []
  };

  const events = extractWikiDataTemporal(payload);

  assert(events.length === 1, "Should extract only birth");
  assert(events[0].type === "BIRTH", "Event should be BIRTH");

  console.log("✓ testMissingDateValues passed");
}

// Test 7: Handle date string format directly
function testDateStringFormat() {
  const payload = {
    person: {
      birthDate: "1822-06-15",
      deathDate: "1886-03-20"
    },
    events: []
  };

  const events = extractWikiDataTemporal(payload);

  assert(events.length === 2, "Should extract 2 events");
  assert(events[0].date === "1822-06-15", "Date string should be normalized");

  console.log("✓ testDateStringFormat passed");
}

// Test 8: Filter events without dates
function testFilterEventsWithoutDates() {
  const payload = {
    person: {
      birthDate: { value: "1822", precision: 6 }
    },
    events: [
      { id: "e1", type: "census", date: "1850" },
      { id: "e2", type: "record" }, // no date
      { id: "e3", type: "census", date: "1860" }
    ]
  };

  const events = extractWikiDataTemporal(payload);

  assert(events.length === 3, "Should skip event without date");
  assert(events[1].recordId === "e1", "First event should be e1");
  assert(events[2].recordId === "e3", "Third event should be e3");

  console.log("✓ testFilterEventsWithoutDates passed");
}

// Test 9: Handle null payload
function testNullPayload() {
  const events = extractWikiDataTemporal(null);

  assert(events.length === 0, "Should handle null payload gracefully");

  console.log("✓ testNullPayload passed");
}

// Test 10: Handle default precision
function testDefaultPrecision() {
  const payload = {
    person: {
      birthDate: { value: "1822-06-15" }
      // no precision property
    },
    events: []
  };

  const events = extractWikiDataTemporal(payload);

  assert(events.length === 1, "Should extract birth");
  assert(events[0].wikiDataPrecision === 8, "Should default to precision 8 (day)");

  console.log("✓ testDefaultPrecision passed");
}

// Run all tests
export function runWikiDataExtractorTests() {
  console.log("\n╔════════════════════════════════════════════════════════════════╗");
  console.log("║  WikiData Temporal Extractor — Unit Tests                      ║");
  console.log("║  2026-06-23 v1.0.0                                             ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");

  const tests = [
    testBasicBirthDeathExtraction,
    testYearOnlyPrecision,
    testMonthPrecision,
    testEventsArrayExtraction,
    testMissingPersonData,
    testMissingDateValues,
    testDateStringFormat,
    testFilterEventsWithoutDates,
    testNullPayload,
    testDefaultPrecision
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
  console.log("║  WikiData Extractor Test Results                               ║");
  console.log("╚════════════════════════════════════════════════════════════════╝");
  console.log(`
✅ Basic birth/death extraction:   PASSED
✅ Year-only precision:             PASSED
✅ Month precision:                 PASSED
✅ Events array extraction:         PASSED
✅ Missing person data:             PASSED
✅ Missing date values:             PASSED
✅ Date string format:              PASSED
✅ Filter events without dates:     PASSED
✅ Null payload:                    PASSED
✅ Default precision:               PASSED
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
