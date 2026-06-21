/**
 * A2A Gateway Type Definitions
 *
 * Defines the data structures for:
 * - A2A Protocol v0.3 objects (Task, Artifact, InputRequest, InputProvided)
 * - CIC Mesh Event Bus messages
 * - Translation/mapping state
 */

/* ============== A2A Protocol v0.3 Types ============== */

export type A2ATaskStatus = 'submitted' | 'working' | 'completed' | 'failed' | 'input-required' | 'cancelled';

export interface A2ATask {
  id: string;
  agentId: string;
  agentName?: string;
  description?: string;
  input: Record<string, unknown>;
  status: A2ATaskStatus;
  result?: A2AArtifact;
  artifacts?: A2AArtifact[];
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
  inputRequest?: A2AInputRequest;
}

export interface A2AArtifact {
  id: string;
  type: 'output' | 'error' | 'input-required';
  mimeType: string;
  content: Record<string, unknown> | string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface A2AInputRequest {
  prompt: string;
  inputSchema?: Record<string, unknown>;
}

export interface A2AInputProvided {
  taskId: string;
  input: Record<string, unknown>;
  providedAt: string;
  providedBy?: string;
}

export interface A2AAgentCard {
  agent_id: string;
  display_name: string;
  description: string;
  version: string;
  layer: 'orchestrator' | 'planner' | 'executor' | 'reviewer';
  capabilities: {
    input_types: string[];
    output_types: string[];
    runtime_profiles: string[];
  };
  endpoints: {
    health: string;
    metrics: string;
    a2a: string;
  };
  well_known_url: string;
}

/* ============== CIC Mesh Event Bus Types ============== */

export type CICEventType =
  | 'TASK_ASSIGNED'
  | 'AGENT_RESULT'
  | 'HITL_GATE_OPEN'
  | 'HITL_GATE_RESOLVED'
  | 'WORKFLOW_COMPLETE'
  | 'WORKFLOW_CANCELLED'
  | 'AGENT_HEARTBEAT'
  | 'DLQ_ENTRY';

export interface CICEvent {
  event_id: string;
  workflow_id: string;
  event_type: CICEventType;
  timestamp: string;
  agent_id?: string;
  step_id?: string;
  payload: Record<string, unknown>;
  metadata?: {
    source?: string;
    correlation_id?: string;
    retries?: number;
  };
}

export interface CICTaskAssigned extends CICEvent {
  event_type: 'TASK_ASSIGNED';
  payload: {
    agent_id: string;
    instruction: string;
    context?: Record<string, unknown>;
  };
}

export interface CICAgentResult extends CICEvent {
  event_type: 'AGENT_RESULT';
  payload: {
    agent_id: string;
    output: Record<string, unknown> | string;
    confidence: number;
  };
}

export interface CICHitlGateOpen extends CICEvent {
  event_type: 'HITL_GATE_OPEN';
  payload: {
    gate_id: string;
    gate_type: 'INFORMATIONAL' | 'CONFIRMATIONAL' | 'BLOCKING';
    description: string;
    required_input_schema?: Record<string, unknown>;
  };
}

export interface CICHitlGateResolved extends CICEvent {
  event_type: 'HITL_GATE_RESOLVED';
  payload: {
    gate_id: string;
    decision: 'approved' | 'rejected' | 'modified';
    resolved_by: string;
    input?: Record<string, unknown>;
  };
}

export interface CICWorkflowComplete extends CICEvent {
  event_type: 'WORKFLOW_COMPLETE';
  payload: {
    workflow_id: string;
    final_output: Record<string, unknown> | string;
    status: 'success' | 'partial' | 'failed';
  };
}

export interface CICWorkflowCancelled extends CICEvent {
  event_type: 'WORKFLOW_CANCELLED';
  payload: {
    workflow_id: string;
    reason: string;
    cancelled_by: string;
  };
}

export interface CICDLQEntry extends CICEvent {
  event_type: 'DLQ_ENTRY';
  payload: {
    original_event_id: string;
    failure_reason: string;
    retry_count: number;
    error_stack?: string;
  };
}

/* ============== Gateway State & Translation ============== */

export interface TaskTranslationState {
  a2a_task_id: string;
  cic_workflow_id: string;
  external_agent_id: string;
  internal_agent_id?: string;
  current_status: A2ATaskStatus;
  open_gate?: {
    gate_id: string;
    gate_type: string;
    input_schema?: Record<string, unknown>;
  };
  sse_clients: Set<(data: string) => void>;
  created_at: string;
  expires_at: string;
}

export interface TranslationMapping {
  outbound: Record<CICEventType, (event: CICEvent) => A2AArtifact | Partial<A2ATask>>;
  inbound: Record<string, (data: unknown) => CICEvent>;
}

export interface GatewayConfig {
  port: number;
  log_level: string;
  event_bus_url: string;
  a2a_version: string;
  max_task_duration_seconds: number;
  health_check_interval: number;
}
