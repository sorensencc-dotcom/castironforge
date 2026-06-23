// providers.js — 2026-06-22 — v1.0.0

import { FamilySearchProvider } from "../agents/enrichment-familysearch.js";

// Import other providers as they are implemented
// import { GeminiProvider } from "../agents/enrichment-gemini.js";
// import { AncestryProvider } from "../agents/enrichment-ancestry.js";

export const Providers = {
  familysearch: FamilySearchProvider
  // gemini: GeminiProvider,
  // ancestry: AncestryProvider
};

export function getProvider(id) {
  const provider = Providers[id];
  if (!provider) {
    throw new Error(`Unknown enrichment provider: ${id}`);
  }
  return provider;
}

export function listProviders() {
  return Object.keys(Providers);
}
