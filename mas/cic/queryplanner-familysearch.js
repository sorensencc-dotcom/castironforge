// queryplanner-familysearch.js — 2026-06-22 — v1.0.0

export const FamilySearchQueryPlanner = {
  id: "familysearch",
  version: "1.0.0",

  plan({ query }) {
    const steps = [];

    // Step 1: Person search
    steps.push({
      action: "SEARCH_PERSON",
      provider: "familysearch",
      query
    });

    // Step 2: Fetch person details
    steps.push({
      action: "FETCH_PERSON",
      provider: "familysearch"
    });

    // Step 3: Fetch memories + records
    steps.push({
      action: "FETCH_MEMORIES",
      provider: "familysearch"
    });

    steps.push({
      action: "FETCH_RECORDS",
      provider: "familysearch"
    });

    return steps;
  }
};
