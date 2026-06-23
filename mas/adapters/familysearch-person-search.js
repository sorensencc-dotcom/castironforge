// familysearch-person-search.js — 2026-06-22 — v1.0.0

import fetch from "node-fetch";
import { loadCredentials } from "../lib/credential-loader.js";

export async function searchPersons({ access_token, query }) {
  if (!access_token) {
    throw new Error("FamilySearch access token missing");
  }

  if (!query || typeof query !== "string") {
    throw new Error("FamilySearch search query missing or invalid");
  }

  const creds = loadCredentials("familysearch");

  const url = `https://api.familysearch.org/platform/tree/search?q=${encodeURIComponent(query)}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "Accept": "application/json",
      "Authorization": `Bearer ${access_token}`
    }
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`FamilySearch Person Search failed: ${text}`);
  }

  const json = await res.json();

  return {
    results: json?.entries ?? [],
    raw: json
  };
}
