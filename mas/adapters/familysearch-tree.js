// familysearch-tree.js — 2026-06-22 — v1.0.0

import fetch from "node-fetch";
import { loadCredentials } from "../lib/credential-loader.js";

export async function getPersonById({ access_token, personId }) {
  if (!access_token) {
    throw new Error("FamilySearch access token missing");
  }

  const creds = loadCredentials("familysearch");

  const url = `https://api.familysearch.org/platform/tree/persons/${personId}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "Accept": "application/json",
      "Authorization": `Bearer ${access_token}`
    }
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`FamilySearch Tree fetch failed: ${text}`);
  }

  const json = await res.json();

  return {
    person: json.persons?.[0] ?? null,
    raw: json
  };
}
