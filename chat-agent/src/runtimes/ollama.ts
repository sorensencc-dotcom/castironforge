import type { RuntimeAdapter, RuntimeStatus, ModelInfo, CompleteParams, StreamParams } from './types';

const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434';

export const ollamaAdapter: RuntimeAdapter = {
  async health(): Promise<RuntimeStatus> {
    // TODO: implement
    return 'ok';
  },

  async models(): Promise<ModelInfo[]> {
    // TODO: GET ${OLLAMA_URL}/api/tags
    return [];
  },

  async complete(params: CompleteParams): Promise<string> {
    // TODO: POST ${OLLAMA_URL}/api/generate
    void params;
    return '';
  },

  async stream(params: StreamParams): Promise<void> {
    // TODO: POST ${OLLAMA_URL}/api/generate with stream:true
    void params;
  },

  async embed(text: string): Promise<number[]> {
    // TODO: POST ${OLLAMA_URL}/api/embeddings
    void text;
    return [];
  }
};
