// kgtemporalprecision.test.js — 2026-06-22 — v1.0.0

import { enhanceFamilySearchTemporalPrecision } from "../kgtemporalprecision-familysearch.js";

const assert = (condition, message) => {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
};

// Test 1: DAY precision unchanged
function testDAYPrecisionUnchanged() {
  const events = [
    { type: "BIRTH", normalizedDate: "1822-06-15", precision: "DAY" }
  ];

  const enhanced = enhanceFamilySearchTemporalPrecision({ events });

  assert(enhanced[0].normalizedDate === "1822-06-15", "DAY precision date should be unchanged");
  assert(enhanced[0].precision === "DAY", "Precision should remain DAY");

  console.log("✓ testDAYPrecisionUnchanged passed");
}

// Test 2: YEAR to INFERRED_DAY
function testYearToInferredDay() {
  const events = [
    { type: "BIRTH", normalizedDate: "1822-06-15", precision: "YEAR" }
  ];

  const enhanced = enhanceFamilySearchTemporalPrecision({ events });

  assert(enhanced[0].normalizedDate === "1822-06-15", "Year should be inferred to mid-year");
  assert(enhanced[0].precision === "INFERRED_DAY", "Precision should be INFERRED_DAY");

  console.log("✓ testYearToInferredDay passed");
}

// Test 3: MONTH to INFERRED_DAY
function testMonthToInferredDay() {
  const events = [
    { type: "MARRIAGE", normalizedDate: "1845-06-15", precision: "MONTH" }
  ];

  const enhanced = enhanceFamilySearchTemporalPrecision({ events });

  assert(enhanced[0].normalizedDate === "1845-06-15", "Month should be inferred to mid-month");
  assert(enhanced[0].precision === "INFERRED_DAY", "Precision should be INFERRED_DAY");

  console.log("✓ testMonthToInferredDay passed");
}

// Test 4: Multiple events
function testMultipleEvents() {
  const events = [
    { type: "BIRTH", normalizedDate: "1822-06-15", precision: "YEAR" },
    { type: "MARRIAGE", normalizedDate: "1845-06-15", precision: "MONTH" },
    { type: "DEATH", normalizedDate: "1886-03-20", precision: "DAY" }
  ];

  const enhanced = enhanceFamilySearchTemporalPrecision({ events });

  assert(enhanced.length === 3, "Should enhance all events");
  assert(enhanced[0].precision === "INFERRED_DAY", "Birth should be INFERRED_DAY");
  assert(enhanced[1].precision === "INFERRED_DAY", "Marriage should be INFERRED_DAY");
  assert(enhanced[2].precision === "DAY", "Death should remain DAY");

  console.log("✓ testMultipleEvents passed");
}

// Test 5: Preserve event metadata
function testPreserveEventMetadata() {
  const events = [
    { type: "CENSUS", normalizedDate: "1850-06-15", precision: "YEAR", source: "familysearch", recordId: "r1" }
  ];

  const enhanced = enhanceFamilySearchTemporalPrecision({ events });

  assert(enhanced[0].type === "CENSUS", "Event type should be preserved");
  assert(enhanced[0].source === "familysearch", "Source should be preserved");
  assert(enhanced[0].recordId === "r1", "Record ID should be preserved");

  console.log("✓ testPreserveEventMetadata passed");
}

// Run all tests
export function runPrecisionTests() {
  testDAYPrecisionUnchanged();
  testYearToInferredDay();
  testMonthToInferredDay();
  testMultipleEvents();
  testPreserveEventMetadata();
  console.log("All precision tests passed!\n");
}
