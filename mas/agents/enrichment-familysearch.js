// enrichment-familysearch.js — 2026-06-22 — v1.0.0

import { searchPersons } from "../adapters/familysearch-person-search.js";
import { getPersonById } from "../adapters/familysearch-tree.js";
import { refreshFamilySearchToken } from "../adapters/familysearch-refresh.js";

export const FamilySearchProvider = {
  id: "familysearch",
  label: "FamilySearch",
  version: "1.0.0",

  async enrich({ token, query }) {
    if (!token || !token.access_token) {
      throw new Error("FamilySearch token missing for enrichment");
    }

    // 1. Search for matching persons
    const search = await searchPersons({
      access_token: token.access_token,
      query
    });

    const entries = search.results ?? [];

    if (entries.length === 0) {
      return {
        provider: "familysearch",
        matches: [],
        raw: search.raw
      };
    }

    // 2. Fetch the first matching person (deterministic)
    const first = entries[0];
    const personId = first?.id;

    if (!personId) {
      return {
        provider: "familysearch",
        matches: [],
        raw: search.raw
      };
    }

    const person = await getPersonById({
      access_token: token.access_token,
      personId
    });

    return {
      provider: "familysearch",
      matches: [
        {
          id: personId,
          person: person.person
        }
      ],
      raw: {
        search: search.raw,
        person: person.raw
      }
    };
  },

  async refreshToken({ token }) {
    if (!token?.refresh_token) return token;

    return await refreshFamilySearchToken({
      refresh_token: token.refresh_token
    });
  }
};
