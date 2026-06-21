export type AutonomyLevel = 'recommended' | 'trusted' | 'autonomous';

export type WorkflowAction = 'REINDEX' | 'REEMBED' | 'FIX_METADATA' | 'EXPAND_CORPUS';

export type WorkflowState = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface WorkflowTask {
  id: string;
  action: WorkflowAction;
  documentId?: string;
  targetPhase?: string;
  targetAdapter?: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  state: WorkflowState;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  error?: string;
  retryCount: number;
  maxRetries: number;
}

export interface WorkflowContext {
  taskId: string;
  action: WorkflowAction;
  documentId?: string;
  metadata?: Record<string, any>;
  sha256?: string;
  phase?: string;
  adapter?: string;
}

export interface AutonomousConfig {
  autonomyLevel: AutonomyLevel;
  maxConcurrentWorkflows: number;
  checkIntervalMs: number;
  retryBackoffMs: number;
  maxRetries: number;
  enableAutoReindex: boolean;
  enableAutoReembed: boolean;
  enableAutoMetadataFix: boolean;
  enableAutoExpand: boolean;
}

export interface CorpusExpansionTarget {
  phase: string;
  adapter?: string;
  currentCount: number;
  targetCount: number;
  reason: string;
}
