// cic-familysearch-activation.js — 2026-06-22 — v1.0.0

import { enrichFamilySearchBundle } from "../agents/enrichment-familysearch-bundle.js";

export const FamilySearchIngestionSource = {
  id: "familysearch",
  label: "FamilySearch",
  version: "1.0.0",

  async ingest({ token, query }) {
    const enriched = await enrichFamilySearchBundle({ token, query });

    return {
      source: "familysearch",
      timestamp: Date.now(),
      payload: enriched,
      tags: {
        hasPerson: !!enriched.person,
        hasMemories: enriched.memories?.length > 0,
        hasRecords: enriched.records?.length > 0
      }
    };
  }
};
