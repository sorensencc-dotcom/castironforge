// familysearch-oauth.js — 2026-06-22 — v1.0.0

import fetch from "node-fetch";
import { loadCredentials } from "../lib/credential-loader.js";

export async function getFamilySearchToken({ code }) {
  const creds = loadCredentials("familysearch");

  if (!creds.client_id || !creds.client_secret) {
    throw new Error("FamilySearch credentials missing");
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: creds.client_id,
    client_secret: creds.client_secret,
    redirect_uri: creds.redirect_uri,
    code
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
    throw new Error(`FamilySearch token exchange failed: ${text}`);
  }

  const json = await res.json();

  return {
    access_token: json.access_token,
    expires_in: json.expires_in,
    refresh_token: json.refresh_token ?? null,
    token_type: json.token_type
  };
}
