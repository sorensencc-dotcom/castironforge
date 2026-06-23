// familysearch-refresh.js — 2026-06-22 — v1.0.0

import fetch from "node-fetch";
import { loadCredentials } from "../lib/credential-loader.js";

export async function refreshFamilySearchToken({ refresh_token }) {
  if (!refresh_token) {
    throw new Error("FamilySearch refresh token missing");
  }

  const creds = loadCredentials("familysearch");

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: creds.client_id,
    client_secret: creds.client_secret,
    refresh_token
  });

  const res = await fetch(creds.token_endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`FamilySearch token refresh failed: ${text}`);
  }

  const json = await res.json();

  return {
    access_token: json.access_token,
    expires_in: json.expires_in,
    refresh_token: json.refresh_token ?? refresh_token,
    token_type: json.token_type
  };
}
