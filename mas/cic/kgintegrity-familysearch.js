// kgintegrity-familysearch.js — 2026-06-22 — v1.0.0

export function auditFamilySearchKGIntegrity({ materialized }) {
  const issues = [];

  // Rule 1: All persons must have names
  for (const p of materialized.persons) {
    if (!p.name) {
      issues.push({
        type: "MISSING_NAME",
        id: p.id,
        message: "Person node missing required name field"
      });
    }
  }

  // Rule 2: All artifacts must have titles
  for (const a of materialized.artifacts) {
    if (!a.title) {
      issues.push({
        type: "MISSING_TITLE",
        id: a.id,
        message: "Artifact node missing required title field"
      });
    }
  }

  // Rule 3: Relations must reference valid nodes
  const allIds = new Set([
    ...materialized.persons.map(p => p.id),
    ...materialized.artifacts.map(a => a.id),
    ...materialized.records.map(r => r.id)
  ]);

  for (const r of materialized.relations) {
    if (!allIds.has(r.from) || !allIds.has(r.to)) {
      issues.push({
        type: "INVALID_RELATION",
        relation: r,
        message: "Relation references missing node(s)"
      });
    }
  }

  return issues;
}
