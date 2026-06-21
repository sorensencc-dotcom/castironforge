/**
 * Agent artifact storage integration with MinIO
 *
 * Stores intermediate outputs from agent reasoning, execution, and synthesis:
 * - Reasoning traces (step-by-step logic)
 * - Execution bundles (outputs, errors, metrics)
 * - Refactor proposals
 * - Multi-step reasoning outputs
 * - Agent state snapshots
 */

import { putObject, getObject, CIC_BUCKETS } from './MinioClient';
import { minioMetricsCollector } from './minioMetrics';

export type ArtifactType = 'reasoning' | 'execution' | 'bundle' | 'proposal' | 'state' | 'trace';

export interface AgentArtifact {
  id: string;
  agentId: string;
  type: ArtifactType;
  sessionId: string;
  taskId: string;
  content: Record<string, unknown>;
  timestamp: number;
  duration?: number;
  status: 'pending' | 'success' | 'failed' | 'cancelled';
  tags?: string[];
}

export interface ExecutionBundle {
  bundleId: string;
  agentId: string;
  sessionId: string;
  startTime: number;
  endTime: number;
  status: 'success' | 'failed';
  outputs: Record<string, unknown>;
  errors?: string[];
  metrics: {
    executionTimeMs: number;
    tokensUsed?: number;
    costEstimate?: number;
  };
}

export interface ReasoningTrace {
  traceId: string;
  agentId: string;
  sessionId: string;
  steps: {
    stepNumber: number;
    description: string;
    input: Record<string, unknown>;
    output: Record<string, unknown>;
    reasoning: string;
    timestamp: number;
  }[];
  totalSteps: number;
  conclusion: string;
}

/**
 * Store agent reasoning trace
 */
export async function storeReasoningTrace(trace: ReasoningTrace): Promise<string> {
  const startTime = Date.now();

  const key = `${trace.agentId}/traces/${trace.traceId}`;

  try {
    const data = JSON.stringify({
      ...trace,
      storedAt: new Date().toISOString(),
    });

    const metadata: Record<string, string> = {
      'content-type': 'application/json',
      'artifact-type': 'reasoning',
      'agent-id': trace.agentId,
      'session-id': trace.sessionId,
      'trace-id': trace.traceId,
      'step-count': trace.totalSteps.toString(),
    };

    await putObject(CIC_BUCKETS.AGENT_ARTIFACTS, key, data, metadata);

    const latencyMs = Date.now() - startTime;
    minioMetricsCollector.recordPutOperation(latencyMs, Buffer.byteLength(data));
    minioMetricsCollector.recordBucketOperation(CIC_BUCKETS.AGENT_ARTIFACTS);

    console.log(`[Agent] Stored reasoning trace: ${trace.traceId} (${trace.totalSteps} steps)`);
    return key;
  } catch (error) {
    minioMetricsCollector.recordError(error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

/**
 * Store agent execution bundle
 */
export async function storeExecutionBundle(bundle: ExecutionBundle): Promise<string> {
  const startTime = Date.now();

  const key = `${bundle.agentId}/bundles/${bundle.bundleId}`;

  try {
    const data = JSON.stringify({
      ...bundle,
      storedAt: new Date().toISOString(),
    });

    const metadata: Record<string, string> = {
      'content-type': 'application/json',
      'artifact-type': 'bundle',
      'agent-id': bundle.agentId,
      'session-id': bundle.sessionId,
      'bundle-id': bundle.bundleId,
      'execution-status': bundle.status,
      'execution-time-ms': bundle.metrics.executionTimeMs.toString(),
    };

    await putObject(CIC_BUCKETS.AGENT_ARTIFACTS, key, data, metadata);

    const latencyMs = Date.now() - startTime;
    minioMetricsCollector.recordPutOperation(latencyMs, Buffer.byteLength(data));
    minioMetricsCollector.recordBucketOperation(CIC_BUCKETS.AGENT_ARTIFACTS);

    console.log(`[Agent] Stored execution bundle: ${bundle.bundleId} (${bundle.status})`);
    return key;
  } catch (error) {
    minioMetricsCollector.recordError(error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

/**
 * Store generic agent artifact
 */
export async function storeAgentArtifact(artifact: AgentArtifact): Promise<string> {
  const startTime = Date.now();

  const key = `${artifact.agentId}/${artifact.type}/${artifact.id}`;

  try {
    const data = JSON.stringify({
      ...artifact,
      storedAt: new Date().toISOString(),
    });

    const metadata: Record<string, string> = {
      'content-type': 'application/json',
      'artifact-type': artifact.type,
      'artifact-id': artifact.id,
      'agent-id': artifact.agentId,
      'session-id': artifact.sessionId,
      'task-id': artifact.taskId,
      'status': artifact.status,
      ...(artifact.tags && { 'tags': artifact.tags.join(',') }),
      ...(artifact.duration && { 'duration-ms': artifact.duration.toString() }),
    };

    await putObject(CIC_BUCKETS.AGENT_ARTIFACTS, key, data, metadata);

    const latencyMs = Date.now() - startTime;
    minioMetricsCollector.recordPutOperation(latencyMs, Buffer.byteLength(data));
    minioMetricsCollector.recordBucketOperation(CIC_BUCKETS.AGENT_ARTIFACTS);

    console.log(`[Agent] Stored ${artifact.type} artifact: ${artifact.id}`);
    return key;
  } catch (error) {
    minioMetricsCollector.recordError(error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

/**
 * Retrieve agent artifact
 */
export async function retrieveAgentArtifact(key: string): Promise<AgentArtifact> {
  const startTime = Date.now();

  try {
    const buffer = await getObject(CIC_BUCKETS.AGENT_ARTIFACTS, key);
    const latencyMs = Date.now() - startTime;
    minioMetricsCollector.recordGetOperation(latencyMs, buffer.length);
    minioMetricsCollector.recordBucketOperation(CIC_BUCKETS.AGENT_ARTIFACTS);

    return JSON.parse(buffer.toString('utf-8'));
  } catch (error) {
    minioMetricsCollector.recordError(error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

/**
 * Store agent state snapshot
 */
export async function storeAgentStateSnapshot(
  agentId: string,
  sessionId: string,
  state: Record<string, unknown>,
  tags?: string[]
): Promise<string> {
  const snapshotId = `${sessionId}-${Date.now()}`;
  const key = `${agentId}/state/${snapshotId}`;

  try {
    const data = JSON.stringify({
      agentId,
      sessionId,
      snapshotId,
      state,
      tags,
      timestamp: Date.now(),
    });

    const metadata: Record<string, string> = {
      'content-type': 'application/json',
      'artifact-type': 'state',
      'agent-id': agentId,
      'session-id': sessionId,
      'snapshot-id': snapshotId,
    };

    await putObject(CIC_BUCKETS.AGENT_ARTIFACTS, key, data, metadata);
    minioMetricsCollector.recordBucketOperation(CIC_BUCKETS.AGENT_ARTIFACTS);

    console.log(`[Agent] Stored state snapshot: ${snapshotId}`);
    return key;
  } catch (error) {
    minioMetricsCollector.recordError(error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

/**
 * List all artifacts for an agent in a session
 */
export async function listSessionArtifacts(agentId: string, sessionId: string): Promise<string[]> {
  // This is a placeholder for future implementation with list operations
  // For now, return empty array
  return [];
}
