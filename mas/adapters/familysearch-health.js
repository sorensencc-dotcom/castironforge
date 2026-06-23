// familysearch-health.js — 2026-06-22 — v1.0.0

import { loadCredentials } from "../lib/credential-loader.js";
import { familySearchFetch } from "./familysearch-throttle.js";

export async function checkFamilySearchHealth() {
  const creds = loadCredentials("familysearch");

  const url = "https://api.familysearch.org/platform/ping";

  try {
    const res = await familySearchFetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "Authorization": `Bearer ${creds.last_known_access_token ?? ""}`
      }
    });

    if (!res.ok) {
      return {
        provider: "familysearch",
        status: "DEGRADED",
        code: res.status
      };
    }

    return {
      provider: "familysearch",
      status: "ONLINE",
      code: 200
    };
  } catch (err) {
    return {
      provider: "familysearch",
      status: "DOWN",
      error: err.message
    };
  }
}
