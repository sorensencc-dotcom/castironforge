// enrichment-familysearch-memories.js — 2026-06-22 — v1.0.0

import { getMemoriesForPerson } from "../adapters/familysearch-memories.js";

export async function enrichFamilySearchMemories({ token, personId }) {
  if (!token?.access_token) {
    throw new Error("FamilySearch token missing for memories enrichment");
  }

  if (!personId) {
    return {
      provider: "familysearch",
      memories: [],
      raw: null
    };
  }

  const memories = await getMemoriesForPerson({
    access_token: token.access_token,
    personId
  });

  return {
    provider: "familysearch",
    memories: memories.items.map(m => ({
      id: m.id,
      title: m.titles?.[0]?.value ?? null,
      type: m.mediaType ?? null,
      about: m.about ?? null,
      links: m.links ?? null
    })),
    raw: memories.raw
  };
}
