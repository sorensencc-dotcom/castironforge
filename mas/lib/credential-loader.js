// credential-loader.js — 2026-06-22 — v1.0.0

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CREDENTIALS_PATH = path.join(__dirname, "../config/archive_credentials.json");

export function loadCredentials(provider) {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    throw new Error(`Credentials file not found: ${CREDENTIALS_PATH}`);
  }

  const raw = fs.readFileSync(CREDENTIALS_PATH, "utf8");
  const creds = JSON.parse(raw);

  if (!creds[provider]) {
    throw new Error(`Credentials for provider '${provider}' not found`);
  }

  return creds[provider];
}
