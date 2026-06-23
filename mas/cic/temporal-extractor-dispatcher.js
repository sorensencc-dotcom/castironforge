// temporal-extractor-dispatcher.js — 2026-06-23 — v1.0.0
// Routes temporal extraction to the appropriate provider adapter

import { extractFamilySearchTemporal } from "./fs-temporal-extract.js";
import { extractAncestryTemporal } from "./ancestry-temporal-extract.js";
import { extractWikiDataTemporal } from "./wikidata-temporal-extract.js";

const extractors = {
  familysearch: extractFamilySearchTemporal,
  ancestry: extractAncestryTemporal,
  wikidata: extractWikiDataTemporal
};

/**
 * Dispatch temporal extraction to the appropriate provider adapter
 *
 * @param {string} provider - Provider name (familysearch, ancestry, wikidata)
 * @param {object} payload - Provider-specific payload
 * @returns {array} Normalized event array
 */
export function dispatchTemporalExtraction(provider, payload) {
  if (!provider || !payload) {
    return [];
  }

  const providerLower = provider.toLowerCase();
  const extractor = extractors[providerLower];

  if (!extractor) {
    // Unknown provider: default to FamilySearch extractor
    // This allows graceful handling of unregistered providers
    return extractFamilySearchTemporal(payload);
  }

  return extractor(payload);
}

/**
 * Register a new provider extractor (for extensibility)
 *
 * @param {string} providerName - Provider identifier
 * @param {function} extractorFunction - Extraction function
 */
export function registerTemporalExtractor(providerName, extractorFunction) {
  extractors[providerName.toLowerCase()] = extractorFunction;
}

/**
 * Get list of registered providers
 *
 * @returns {array} Array of provider names
 */
export function getRegisteredProviders() {
  return Object.keys(extractors);
}
