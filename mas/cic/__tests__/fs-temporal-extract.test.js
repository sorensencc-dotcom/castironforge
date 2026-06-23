// fs-temporal-extract.test.js — 2026-06-22 — v1.0.0

import { extractFamilySearchTemporal } from "../fs-temporal-extract.js";

const assert = (condition, message) => {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
};

// Test 1: Extract birth and death from FamilySearch payload
function testExtractBirthAndDeath() {
  const fsPayload = {
    person: {
      display: {
        birthDate: "1822-06-15",
        deathDate: "1886-00-00"
      }
    },
    records: []
  };

  const events = extractFamilySearchTemporal(fsPayload);

  assert(events.length === 2, "Should extract 2 events (birth and death)");
  assert(events[0].type === "BIRTH", "First event should be BIRTH");
  assert(events[0].date === "1822-06-15", "Birth date should match");
  assert(events[1].type === "DEATH", "Second event should be DEATH");
  assert(events[1].source === "familysearch", "Source should be FamilySearch");

  console.log("✓ testExtractBirthAndDeath passed");
}

// Test 2: Extract records as temporal events
function testExtractRecords() {
  const fsPayload = {
    person: { display: {} },
    records: [
      { id: "r1", type: "CENSUS", date: "1850" },
      { id: "r2", type: "MARRIAGE", date: "1845-06" },
      { id: "r3", type: "BIRTH", date: null } // Skip events with no date
    ]
  };

  const events = extractFamilySearchTemporal(fsPayload);

  assert(events.length === 2, "Should extract 2 records (skip null date)");
  assert(events[0].type === "CENSUS", "First record should be CENSUS");
  assert(events[0].recordId === "r1", "Record ID should be preserved");
  assert(events[1].type === "MARRIAGE", "Second record should be MARRIAGE");

  console.log("✓ testExtractRecords passed");
}

// Test 3: Handle missing person data gracefully
function testHandleMissingData() {
  const fsPayload = {
    person: null,
    records: []
  };

  const events = extractFamilySearchTemporal(fsPayload);

  assert(events.length === 0, "Should extract 0 events from empty payload");

  console.log("✓ testHandleMissingData passed");
}

// Test 4: Uppercase record types
function testUppercaseRecordTypes() {
  const fsPayload = {
    person: { display: {} },
    records: [
      { id: "r1", type: "census", date: "1850" },
      { id: "r2", type: null, date: "1860" }
    ]
  };

  const events = extractFamilySearchTemporal(fsPayload);

  assert(events[0].type === "CENSUS", "Record type should be uppercased");
  assert(events[1].type === "RECORD", "Null type should default to RECORD");

  console.log("✓ testUppercaseRecordTypes passed");
}

// Run all tests
export function runExtractTests() {
  testExtractBirthAndDeath();
  testExtractRecords();
  testHandleMissingData();
  testUppercaseRecordTypes();
  console.log("All extract tests passed!\n");
}
