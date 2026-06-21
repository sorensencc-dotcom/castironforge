export interface TagContext {
  repo: string;
  path: string;
  text: string;
  metadata: Record<string, any>;
  explicitPhase?: string;
  explicitAdapter?: string;
}

export interface Tags {
  phase?: string;
  adapter?: string;
  subsystem?: string;
}

export interface CorpusIntegrityIssue {
  id: string;
  type: "MISSING_INDEX" | "MISSING_VECTOR" | "HASH_MISMATCH" | "MISSING_METADATA";
  details?: Record<string, any>;
}

export interface CorpusDriftIssue {
  id: string;
  type: "RAW_CHANGED" | "EMBEDDING_STALE" | "METADATA_STALE";
  details?: Record<string, any>;
}

export interface CorpusSummary {
  byPhase: Record<string, number>;
  byAdapter: Record<string, number>;
  bySubsystem: Record<string, number>;
  totalDocs: number;
  timestamp: string;
}

export interface CorpusRecommendation {
  action: "REINDEX" | "REEMBED" | "FIX_METADATA" | "EXPAND_CORPUS";
  id?: string;
  target?: string;
  reason: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
}

export interface CorpusHealthStatus {
  summary: CorpusSummary;
  integrityIssues: number;
  driftIssues: number;
  status: "HEALTHY" | "NEEDS_ATTENTION";
  timestamp: string;
}
