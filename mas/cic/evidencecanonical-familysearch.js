// evidencecanonical-familysearch.js — 2026-06-22 — v1.0.0

export function canonicalizeFamilySearchEvidence({ fsEvidence, providerEvidence }) {
  const canonical = [];

  for (const e of fsEvidence) {
    canonical.push({
      provider: "familysearch",
      type: e.type ?? "UNKNOWN",
      weight: e.weight ?? 0.5,
      canonicalId: `fs-e:${e.id ?? crypto.randomUUID()}`
    });
  }

  for (const provider of Object.keys(providerEvidence)) {
    for (const e of providerEvidence[provider]) {
      canonical.push({
        provider,
        type: e.type ?? "UNKNOWN",
        weight: e.weight ?? 0.5,
        canonicalId: `${provider}-e:${e.id ?? crypto.randomUUID()}`
      });
    }
  }

  return canonical;
}
