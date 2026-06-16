import type { RuntimeAdapter, HealthStatus, RuntimeModel, CompleteParams, StreamParams } from './types';
import { TORQUE_URL } from './config';

interface TorqueHealthResponse {
  status: HealthStatus;
}

export const torqueAdapter: RuntimeAdapter = {
  async health(): Promise<HealthStatus> {
    try {
      const res = await fetch(`${TORQUE_URL}/health`);
      if (!res.ok) return 'error';
      const data = (await res.json()) as TorqueHealthResponse;
      return data.status;
    } catch {
      return 'error';
    }
  },

  async models(): Promise<RuntimeModel[]> {
    return [];
  },

  async complete(_params: CompleteParams): Promise<string> {
    throw new Error('TorqueAdapter.complete: inference not supported (retrieval-only runtime)');
  },

  async stream(_params: StreamParams): Promise<void> {
    throw new Error('TorqueAdapter.stream: inference not supported (retrieval-only runtime)');
  },

  async embed(_text: string): Promise<number[]> {
    throw new Error('TorqueAdapter.embed: embeddings not supported (retrieval-only runtime)');
  }
};
