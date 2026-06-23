// anomalydetector-familysearch.js — 2026-06-22 — v1.0.0

export function detectFamilySearchGenerationalAnomalies({ lineage }) {
  const anomalies = [];
  const personMap = new Map(lineage.map(p => [p.id, p]));

  for (const p of lineage) {
    // Anomaly: Birth after death
    if (p.birth && p.death && p.birth > p.death) {
      anomalies.push({
        id: p.id,
        type: "BIRTH_AFTER_DEATH",
        birth: p.birth,
        death: p.death
      });
    }

    // Anomaly: Unrealistic lifespan
    if (p.birth && p.death) {
      const lifespan = parseInt(p.death) - parseInt(p.birth);
      if (lifespan < 0 || lifespan > 120) {
        anomalies.push({
          id: p.id,
          type: "UNREALISTIC_LIFESPAN",
          lifespan,
          birth: p.birth,
          death: p.death
        });
      }
    }

    // Anomaly: Too many parents
    if ((p.parents?.length ?? 0) > 2) {
      anomalies.push({
        id: p.id,
        type: "TOO_MANY_PARENTS",
        parentCount: p.parents.length
      });
    }

    // Anomaly: Child born before parent
    if (p.birth && p.parents?.length > 0) {
      for (const parentId of p.parents) {
        const parent = personMap.get(parentId);
        if (parent?.birth && p.birth < parent.birth) {
          anomalies.push({
            id: p.id,
            type: "CHILD_BEFORE_PARENT",
            parentId,
            childBirth: p.birth,
            parentBirth: parent.birth
          });
        }
      }
    }
  }

  return anomalies;
}
