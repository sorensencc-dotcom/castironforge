// cic-pipeline-config.js — 2026-06-22 — v1.0.0
// CIC FamilySearch Temporal Pipeline Configuration

export const pipeline = {
  id: "familysearch-temporal",
  description: "FamilySearch → CIC Temporal Processing Pipeline",
  stages: [
    {
      id: "fs.ingest",
      type: "source",
      module: "fsIngestAdapter",
      description: "Ingest FamilySearch payload"
    },
    {
      id: "fs.temporal",
      type: "transform",
      module: "cicFamilySearchTemporalStage",
      description: "Run all 8 temporal engines (extract, normalize, enhance, consistency, drift, arbitration, stability, reconstruction)"
    },
    {
      id: "kg.write",
      type: "sink",
      module: "kgWriteAdapter",
      description: "Write temporal data to CIC KG"
    }
  ]
};
