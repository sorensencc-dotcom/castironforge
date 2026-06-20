/**
 * Agent orchestration types and definitions
 */

export type AgentRole = 'supervisor' | 'harvester' | 'enricher' | 'evaluator' | 'custom';

export interface AgentDefinition {
  id: string;
  role: AgentRole;
  model: string;
  description?: string;
  capabilities?: string[];
  maxConcurrency?: number;
  timeout?: number;
}

export interface TaskRequest {
  taskId: string;
  sessionId: string;
  agent: AgentRole;
  instruction: string;
  context?: Record<string, any>;
  priority?: number;
}

export interface TaskResult {
  taskId: string;
  agent: AgentRole;
  status: 'success' | 'failed' | 'timeout' | 'rejected';
  output?: any;
  error?: string;
  duration: number;
  tokensUsed: number;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  steps: WorkflowStep[];
}

export interface WorkflowStep {
  id: string;
  agent: AgentRole;
  instruction: string;
  dependsOn?: string[];
  onSuccess?: string;
  onFailure?: string;
}

export interface WorkflowExecution {
  workflowId: string;
  executionId: string;
  sessionId: string;
  status: 'running' | 'success' | 'failed';
  steps: Map<string, TaskResult>;
  startTime: number;
  endTime?: number;
}

export interface OrchestrationConfig {
  agents: Map<AgentRole, AgentDefinition>;
  workflows?: Map<string, WorkflowDefinition>;
  maxConcurrentTasks?: number;
  defaultTimeout?: number;
  enableLogging?: boolean;
}
