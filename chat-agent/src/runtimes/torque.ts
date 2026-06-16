import type { RuntimeAdapter, RuntimeStatus, ModelInfo, CompleteParams, StreamParams } from './types';

const TORQUE_URL = process.env.TORQUE_URL ?? 'http://localhost:9000';

export const torqueAdapter: RuntimeAdapter = {
  async health(): Promise<RuntimeStatus> {
    // TODO: GET ${TORQUE_URL}/health
    return 'ok';
  },

  async models(): Promise<ModelInfo[]> {
    // TorqueQuery is a retrieval engine, not an inference runtime.
    // Returns empty — models come from Ollama and llama.cpp.
    return [];
  },

  async complete(params: CompleteParams): Promise<string> {
    // TODO: POST ${TORQUE_URL}/query
    void params;
    return '';
  },

  async stream(params: StreamParams): Promise<void> {
    // TODO: streaming via TorqueQuery
    void params;
  },

  async embed(text: string): Promise<number[]> {
    // TODO: POST ${TORQUE_URL}/embed
    void text;
    return [];
  }
};
