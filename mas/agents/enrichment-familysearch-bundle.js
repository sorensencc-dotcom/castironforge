// enrichment-familysearch-bundle.js — 2026-06-22 — v1.0.0

import { searchPersons } from "../adapters/familysearch-person-search.js";
import { getPersonById } from "../adapters/familysearch-tree.js";
import { getMemoriesForPerson } from "../adapters/familysearch-memories.js";
import { getRecordsForPerson } from "../adapters/familysearch-records.js";

export async function enrichFamilySearchBundle({ token, query }) {
  if (!token?.access_token) {
    throw new Error("FamilySearch token missing for unified enrichment");
  }

  // 1. Search
  const search = await searchPersons({
    access_token: token.access_token,
    query
  });

  const first = search.results?.[0];
  const personId = first?.id;

  if (!personId) {
    return {
      provider: "familysearch",
      person: null,
      memories: [],
      records: [],
      raw: { search: search.raw }
    };
  }

  // 2. Person
  const person = await getPersonById({
    access_token: token.access_token,
    personId
  });

  // 3. Memories
  const memories = await getMemoriesForPerson({
    access_token: token.access_token,
    personId
  });

  // 4. Records
  const records = await getRecordsForPerson({
    access_token: token.access_token,
    personId
  });

  return {
    provider: "familysearch",
    person: person.person,
    memories: memories.items,
    records: records.records,
    raw: {
      search: search.raw,
      person: person.raw,
      memories: memories.raw,
      records: records.raw
    }
  };
}
