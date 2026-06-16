import type { RuntimeAdapter, RuntimeStatus, ModelInfo, CompleteParams, StreamParams } from './types';

const LLAMACPP_URL = process.env.LLAMACPP_URL ?? 'http://localhost:8080';

export const llamaCppAdapter: RuntimeAdapter = {
  async health(): Promise<RuntimeStatus> {
    // TODO: GET ${LLAMACPP_URL}/health
    return 'ok';
  },

  async models(): Promise<ModelInfo[]> {
    // TODO: GET ${LLAMACPP_URL}/v1/models
    return [];
  },

  async complete(params: CompleteParams): Promise<string> {
    // TODO: POST ${LLAMACPP_URL}/completion
    void params;
    return '';
  },

  async stream(params: StreamParams): Promise<void> {
    // TODO: POST ${LLAMACPP_URL}/completion with stream:true
    void params;
  },

  async embed(text: string): Promise<number[]> {
    // TODO: POST ${LLAMACPP_URL}/embedding
    void text;
    return [];
  }
};
