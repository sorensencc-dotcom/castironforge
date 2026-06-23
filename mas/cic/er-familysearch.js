// er-familysearch.js — 2026-06-22 — v1.0.0

export const FamilySearchEntityResolution = {
  id: "familysearch",
  version: "1.0.0",

  resolvePerson(node) {
    return {
      canonicalId: `person:${node.name}:${node.birth ?? "unknown"}`,
      attributes: {
        name: node.name,
        birth: node.birth,
        death: node.death,
        gender: node.gender,
        source: "familysearch"
      }
    };
  },

  resolveArtifact(node) {
    return {
      canonicalId: `artifact:${node.title}:${node.mediaType}`,
      attributes: {
        title: node.title,
        mediaType: node.mediaType,
        source: "familysearch"
      }
    };
  },

  resolveRecord(node) {
    return {
      canonicalId: `record:${node.title}:${node.collection}`,
      attributes: {
        title: node.title,
        collection: node.collection,
        source: "familysearch"
      }
    };
  }
};
