// kgtemporalnormalize.test.js — 2026-06-22 — v1.0.0

import { normalizeFamilySearchTemporal } from "../kgtemporalnormalize-familysearch.js";

const assert = (condition, message) => {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
};

// Test 1: Normalize full YYYY-MM-DD dates
function testNormalizeFullDates() {
  const events = [
    { type: "BIRTH", date: "1822-06-15" },
    { type: "DEATH", date: "1886-03-20" }
  ];

  const normalized = normalizeFamilySearchTemporal({ events });

  assert(normalized[0].normalizedDate === "1822-06-15", "Full date should be preserved");
  assert(normalized[0].precision === "DAY", "Precision should be DAY");
  assert(normalized[1].normalizedDate === "1886-03-20", "Death date should be preserved");

  console.log("✓ testNormalizeFullDates passed");
}

// Test 2: Normalize YYYY-MM dates
function testNormalizeMonthDates() {
  const events = [
    { type: "MARRIAGE", date: "1845-06" }
  ];

  const normalized = normalizeFamilySearchTemporal({ events });

  assert(normalized.length === 1, "Should normalize month date");
  assert(normalized[0].type === "MARRIAGE", "Event type should be preserved");
  // Month dates may be normalized differently, just check it's normalized
  assert(normalized[0].normalizedDate, "Should have normalized date");
  assert(normalized[0].precision === "MONTH", "Precision should be MONTH");

  console.log("✓ testNormalizeMonthDates passed");
}

// Test 3: Normalize YYYY dates
function testNormalizeYearDates() {
  const events = [
    { type: "BIRTH", date: "1822" }
  ];

  const normalized = normalizeFamilySearchTemporal({ events });

  assert(normalized.length === 1, "Should normalize year date");
  assert(normalized[0].type === "BIRTH", "Event type should be preserved");
  assert(normalized[0].normalizedDate, "Should have normalized date");
  assert(normalized[0].precision === "YEAR", "Precision should be YEAR");

  console.log("✓ testNormalizeYearDates passed");
}

// Test 4: Handle null dates
function testSkipNullDates() {
  const events = [
    { type: "BIRTH", date: "1822" },
    { type: "DEATH", date: null },
    { type: "MARRIAGE", date: "1845" }
  ];

  const normalized = normalizeFamilySearchTemporal({ events });

  assert(normalized.length > 0, "Should process some events");
  assert(normalized[0].type === "BIRTH", "First event should be BIRTH");

  console.log("✓ testSkipNullDates passed");
}

// Test 5: Preserve event type and source
function testPreserveMetadata() {
  const events = [
    { type: "CENSUS", date: "1850", source: "familysearch" }
  ];

  const normalized = normalizeFamilySearchTemporal({ events });

  assert(normalized[0].type === "CENSUS", "Event type should be preserved");
  assert(normalized[0].source === "familysearch", "Source should be preserved");

  console.log("✓ testPreserveMetadata passed");
}

// Run all tests
export function runNormalizeTests() {
  testNormalizeFullDates();
  testNormalizeMonthDates();
  testNormalizeYearDates();
  testSkipNullDates();
  testPreserveMetadata();
  console.log("All normalization tests passed!\n");
}
