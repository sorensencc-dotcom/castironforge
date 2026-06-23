// familysearch-records.js — 2026-06-22 — v1.0.0

import { familySearchFetch } from "./familysearch-throttle.js";
import { loadCredentials } from "../lib/credential-loader.js";

export async function getRecordsForPerson({ access_token, personId }) {
  if (!access_token) {
    throw new Error("FamilySearch access token missing");
  }

  if (!personId) {
    throw new Error("FamilySearch personId missing");
  }

  const creds = loadCredentials("familysearch");

  const url = `https://api.familysearch.org/platform/tree/persons/${personId}/matches`;

  const res = await familySearchFetch(url, {
    method: "GET",
    headers: {
      "Accept": "application/json",
      "Authorization": `Bearer ${access_token}`
    }
  });

  const json = await res.json();

  return {
    records: json?.entries ?? [],
    raw: json
  };
}
