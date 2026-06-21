/**
 * Event Translator
 *
 * Implements the bidirectional translation between CIC Mesh Event Bus
 * messages and A2A Protocol v0.3 objects per Appendix B of the
 * CIC Mesh v1.1 Gap Analysis.
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  CICEvent,
  CICEventType,
  A2ATask,
  A2AArtifact,
  A2AInputRequest,
  TaskTranslationState
} from './types.js';

export class EventTranslator {
  private taskStates: Map<string, TaskTranslationState> = new Map();

  /**
   * Translate inbound A2A Task to CIC Mesh TASK_ASSIGNED event
   */
  translateA2ATaskToCICEvent(a2aTask: A2ATask): { event: CICEvent; state: TaskTranslationState } {
    const cicWorkflowId = uuidv4();
    const eventId = uuidv4();
    const now = new Date().toISOString();

    const state: TaskTranslationState = {
      a2a_task_id: a2aTask.id,
      cic_workflow_id: cicWorkflowId,
      external_agent_id: a2aTask.agentId,
      current_status: 'working',
      sse_clients: new Set(),
      created_at: now,
      expires_at: a2aTask.expiresAt || new Date(Date.now() + 86400000).toISOString()
    };

    const event: CICEvent = {
      event_id: eventId,
      workflow_id: cicWorkflowId,
      event_type: 'TASK_ASSIGNED',
      timestamp: now,
      agent_id: undefined,
      payload: {
        agent_id: a2aTask.agentId,
        instruction: a2aTask.description || `A2A Task: ${a2aTask.id}`,
        context: a2aTask.input
      },
      metadata: {
        source: 'a2a-gateway',
        correlation_id: a2aTask.id
      }
    };

    this.taskStates.set(cicWorkflowId, state);
    return { event, state };
  }

  /**
   * Translate CIC Mesh AGENT_RESULT event to A2A Artifact
   */
  translateCICResultToA2AArtifact(cicEvent: CICEvent, mimeType: string = 'application/json'): A2AArtifact {
    const state = this.findStateByWorkflowId(cicEvent.workflow_id);
    const payload = cicEvent.payload as Record<string, unknown>;

    return {
      id: `${state?.a2a_task_id || 'unknown'}-${cicEvent.step_id || 'result'}`,
      type: 'output',
      mimeType,
      content: (typeof payload.output === 'object' ? payload.output : { output: payload.output }) as Record<string, unknown>,
      metadata: {
        confidence: payload.confidence,
        agent_id: cicEvent.agent_id,
        created_at: cicEvent.timestamp
      },
      createdAt: cicEvent.timestamp
    };
  }

  /**
   * Translate CIC Mesh HITL_GATE_OPEN event to A2A input-required status + InputRequest
   */
  translateCICHitlGateToA2AInputRequest(cicEvent: CICEvent): {
    inputRequest: A2AInputRequest;
    status: 'input-required';
  } {
    const payload = cicEvent.payload as Record<string, unknown>;

    return {
      status: 'input-required',
      inputRequest: {
        prompt: (payload.description as string) || 'Gate awaiting human input',
        inputSchema: (payload.required_input_schema as Record<string, unknown>) || undefined
      }
    };
  }

  /**
   * Translate A2A InputProvided message to CIC Mesh HITL_GATE_RESOLVED event
   */
  translateA2AInputProvidedToCICEvent(a2aTaskId: string, input: Record<string, unknown>): CICEvent | null {
    const state = this.findStateByA2ATaskId(a2aTaskId);
    if (!state) return null;

    return {
      event_id: uuidv4(),
      workflow_id: state.cic_workflow_id,
      event_type: 'HITL_GATE_RESOLVED',
      timestamp: new Date().toISOString(),
      payload: {
        gate_id: state.open_gate?.gate_id || 'unknown',
        decision: 'approved',
        resolved_by: 'a2a-gateway',
        input
      },
      metadata: {
        source: 'a2a-gateway',
        correlation_id: a2aTaskId
      }
    };
  }

  /**
   * Translate CIC Mesh WORKFLOW_COMPLETE event to A2A completed status with Artifacts
   */
  translateCICWorkflowCompleteToA2ATask(cicEvent: CICEvent): Partial<A2ATask> {
    const state = this.findStateByWorkflowId(cicEvent.workflow_id);
    const payload = cicEvent.payload as Record<string, unknown>;

    const finalOutput = (typeof payload.final_output === 'object' && payload.final_output !== null)
      ? (payload.final_output as Record<string, unknown>)
      : {};

    const artifacts: A2AArtifact[] = [
      {
        id: `${state?.a2a_task_id || 'unknown'}-final`,
        type: 'output',
        mimeType: 'application/json',
        content: finalOutput,
        metadata: {
          status: payload.status,
          workflow_id: cicEvent.workflow_id
        },
        createdAt: cicEvent.timestamp
      }
    ];

    return {
      status: 'completed',
      result: artifacts[0],
      artifacts,
      updatedAt: cicEvent.timestamp
    };
  }

  /**
   * Translate CIC Mesh DLQ_ENTRY event to A2A error Artifact
   */
  translateCICDLQToA2AErrorArtifact(cicEvent: CICEvent): A2AArtifact {
    const state = this.findStateByWorkflowId(cicEvent.workflow_id);
    const payload = cicEvent.payload as Record<string, unknown>;

    return {
      id: `${state?.a2a_task_id || 'unknown'}-error`,
      type: 'error',
      mimeType: 'application/vnd.cicmesh.error+json',
      content: {
        failure_reason: payload.failure_reason,
        retry_count: payload.retry_count,
        error_stack: payload.error_stack,
        original_event_id: payload.original_event_id
      },
      metadata: {
        dlq_entry: true
      },
      createdAt: cicEvent.timestamp
    };
  }

  /**
   * Translate A2A Task cancellation to CIC Mesh WORKFLOW_CANCELLED event
   */
  translateA2ACancellationToCICEvent(a2aTaskId: string): CICEvent | null {
    const state = this.findStateByA2ATaskId(a2aTaskId);
    if (!state) return null;

    return {
      event_id: uuidv4(),
      workflow_id: state.cic_workflow_id,
      event_type: 'WORKFLOW_CANCELLED',
      timestamp: new Date().toISOString(),
      payload: {
        workflow_id: state.cic_workflow_id,
        reason: 'Cancelled via A2A protocol',
        cancelled_by: 'a2a-external-client'
      },
      metadata: {
        source: 'a2a-gateway',
        correlation_id: a2aTaskId
      }
    };
  }

  /**
   * Look up task state by CIC workflow ID
   */
  findStateByWorkflowId(workflowId: string): TaskTranslationState | undefined {
    return this.taskStates.get(workflowId);
  }

  /**
   * Look up task state by A2A task ID
   */
  findStateByA2ATaskId(a2aTaskId: string): TaskTranslationState | undefined {
    for (const state of this.taskStates.values()) {
      if (state.a2a_task_id === a2aTaskId) {
        return state;
      }
    }
    return undefined;
  }

  /**
   * Update task state when HITL gate opens
   */
  updateStateWithOpenGate(workflowId: string, gateId: string, gateType: string, inputSchema?: Record<string, unknown>): void {
    const state = this.findStateByWorkflowId(workflowId);
    if (state) {
      state.open_gate = { gate_id: gateId, gate_type: gateType, input_schema: inputSchema };
      state.current_status = 'input-required';
    }
  }

  /**
   * Update task state when status changes
   */
  updateStateStatus(workflowId: string, status: string): void {
    const state = this.findStateByWorkflowId(workflowId);
    if (state) {
      state.current_status = status as any;
    }
  }

  /**
   * Register SSE client for a task
   */
  registerSSEClient(workflowId: string, client: (data: string) => void): void {
    const state = this.findStateByWorkflowId(workflowId);
    if (state) {
      state.sse_clients.add(client);
    }
  }

  /**
   * Unregister SSE client for a task
   */
  unregisterSSEClient(workflowId: string, client: (data: string) => void): void {
    const state = this.findStateByWorkflowId(workflowId);
    if (state) {
      state.sse_clients.delete(client);
    }
  }

  /**
   * Broadcast SSE event to all clients subscribed to a task
   */
  broadcastSSE(workflowId: string, data: Record<string, unknown>): void {
    const state = this.findStateByWorkflowId(workflowId);
    if (state && state.sse_clients.size > 0) {
      const sseMessage = `data: ${JSON.stringify(data)}\n\n`;
      state.sse_clients.forEach(client => client(sseMessage));
    }
  }

  /**
   * Clean up expired task states
   */
  cleanupExpiredTasks(): void {
    const now = new Date();
    const expired: string[] = [];

    for (const [workflowId, state] of this.taskStates.entries()) {
      if (new Date(state.expires_at) < now) {
        expired.push(workflowId);
      }
    }

    expired.forEach(workflowId => this.taskStates.delete(workflowId));
  }
}

export const translator = new EventTranslator();
