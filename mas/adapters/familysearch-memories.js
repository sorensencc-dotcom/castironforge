// familysearch-memories.js — 2026-06-22 — v1.0.0

import fetch from "node-fetch";
import { loadCredentials } from "../lib/credential-loader.js";

export async function getMemoriesForPerson({ access_token, personId }) {
  if (!access_token) {
    throw new Error("FamilySearch access token missing");
  }

  if (!personId) {
    throw new Error("FamilySearch personId missing");
  }

  const creds = loadCredentials("familysearch");

  const url = `https://api.familysearch.org/platform/memories/memories?person=${personId}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "Accept": "application/json",
      "Authorization": `Bearer ${access_token}`
    }
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`FamilySearch Memories fetch failed: ${text}`);
  }

  const json = await res.json();

  return {
    items: json?.sourceDescriptions ?? [],
    raw: json
  };
}
