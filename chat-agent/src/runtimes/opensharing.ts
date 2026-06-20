import type { RuntimeAdapter, HealthStatus, RuntimeModel, CompleteParams, StreamParams } from './types';
import { OPENSHARING_URL, OPENSHARING_PRINCIPAL_ID, OPENSHARING_NAMESPACE } from './config';
import { getCredentialManager } from './credentialManager';

// OpenSharing API types
interface OpenSharingModel {
  name: string;
  assetVersion: string;
  shareNamespace: string;
  parameterSize?: string;
  contextLength?: number;
  modelServingUrl?: string;
}

interface OpenSharingCredentials {
  accessToken: string;
  expiryTime: number;
  storageUrl: string;
  storageType: 'aws' | 'azure' | 'gcs' | 'r2';
}

interface OpenSharingModelsResponse {
  models: OpenSharingModel[];
}

interface OpenSharingHealthResponse {
  status: 'healthy' | 'degraded' | 'unavailable';
  timestamp: string;
}

interface OpenSharingInferenceRequest {
  modelName: string;
  modelVersion: string;
  prompt: string;
}

interface OpenSharingInferenceResponse {
  result: string;
  tokensUsed: number;
}

interface OpenSharingStreamChunk {
  token: string;
  done: boolean;
}

export const opensharingAdapter: RuntimeAdapter = {
  async health(): Promise<HealthStatus> {
    try {
      const res = await fetch(`${OPENSHARING_URL}/health`, {
        headers: {
          'Authorization': `Bearer ${OPENSHARING_PRINCIPAL_ID}`
        }
      });

      if (!res.ok) {
        return 'error';
      }

      const data = (await res.json()) as OpenSharingHealthResponse;
      return data.status === 'healthy' ? 'ok' : 'degraded';
    } catch {
      return 'error';
    }
  },

  async models(): Promise<RuntimeModel[]> {
    try {
      const res = await fetch(
        `${OPENSHARING_URL}/shares/${OPENSHARING_NAMESPACE}/models`,
        {
          headers: {
            'Authorization': `Bearer ${OPENSHARING_PRINCIPAL_ID}`
          }
        }
      );

      if (!res.ok) {
        return [];
      }

      const data = (await res.json()) as OpenSharingModelsResponse;
      return data.models.map(m => ({
        id: `sharing:${m.name}-v${m.assetVersion}`,
        name: m.name,
        runtime: 'opensharing',
        size: m.parameterSize
      }));
    } catch {
      return [];
    }
  },

  async complete({ model, message }: CompleteParams): Promise<string> {
    const { modelName, modelVersion } = parseModelId(model);

    // Try Model Serving endpoint first (if available)
    const servingUrl = await getModelServingUrl(modelName, modelVersion);
    if (servingUrl) {
      return invokeViaModelServing(servingUrl, message);
    }

    // Fallback: download weights and run locally
    const credentials = await getCredentials(modelName, modelVersion);
    const weights = await downloadWeights(credentials.storageUrl, credentials.storageType);
    return runLocalInference(weights, message);
  },

  async stream({ model, message, onToken, onDone }: StreamParams): Promise<void> {
    const { modelName, modelVersion } = parseModelId(model);

    const servingUrl = await getModelServingUrl(modelName, modelVersion);
    if (servingUrl) {
      await streamViaModelServing(servingUrl, message, onToken, onDone);
      return;
    }

    // Fallback: local streaming
    const credentials = await getCredentials(modelName, modelVersion);
    const weights = await downloadWeights(credentials.storageUrl, credentials.storageType);
    await streamLocalInference(weights, message, onToken, onDone);
  },

  async embed(text: string): Promise<number[]> {
    // OpenSharing embedding models (future)
    // For now, delegate to a default embedding model
    const credentials = await getCredentials('embedding-v1', '1');
    const weights = await downloadWeights(credentials.storageUrl, credentials.storageType);
    return computeEmbedding(weights, text);
  }
};

// Helper functions

function parseModelId(modelId: string): { modelName: string; modelVersion: string } {
  const match = modelId.match(/^sharing:(.+)-v(.+)$/);
  if (!match) {
    throw new Error(`Invalid OpenSharing model ID: ${modelId}`);
  }
  return { modelName: match[1], modelVersion: match[2] };
}

async function getCredentials(
  modelName: string,
  modelVersion: string
): Promise<OpenSharingCredentials> {
  try {
    const manager = getCredentialManager();
    const creds = await manager.getCredentials({
      shareNamespace: OPENSHARING_NAMESPACE,
      assetName: modelName,
      assetVersion: modelVersion,
      accessType: 'read'
    });

    return {
      accessToken: creds.token,
      expiryTime: creds.expiryTime,
      storageUrl: creds.storageUrl,
      storageType: creds.storageType
    };
  } catch (err) {
    throw new Error(`Failed to get OpenSharing credentials: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function getModelServingUrl(modelName: string, modelVersion: string): Promise<string | null> {
  try {
    const res = await fetch(
      `${OPENSHARING_URL}/shares/${OPENSHARING_NAMESPACE}/models/${modelName}/v${modelVersion}/serving`,
      {
        headers: {
          'Authorization': `Bearer ${OPENSHARING_PRINCIPAL_ID}`
        }
      }
    );

    if (!res.ok) {
      return null;
    }

    const data = (await res.json()) as { servingUrl: string };
    return data.servingUrl;
  } catch {
    return null;
  }
}

async function invokeViaModelServing(servingUrl: string, prompt: string): Promise<string> {
  const res = await fetch(`${servingUrl}/invoke`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENSHARING_PRINCIPAL_ID}`
    },
    body: JSON.stringify({ prompt })
  });

  if (!res.ok) {
    throw new Error(`Model serving invocation failed: HTTP ${res.status}`);
  }

  const data = (await res.json()) as OpenSharingInferenceResponse;
  return data.result;
}

async function streamViaModelServing(
  servingUrl: string,
  prompt: string,
  onToken: (token: string) => void,
  onDone: () => void
): Promise<void> {
  const res = await fetch(`${servingUrl}/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENSHARING_PRINCIPAL_ID}`
    },
    body: JSON.stringify({ prompt })
  });

  if (!res.ok || !res.body) {
    throw new Error(`Model serving stream failed: HTTP ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let finished = false;

  while (!finished) {
    const chunk = await reader.read();
    if (chunk.done) break;

    const text = decoder.decode(chunk.value, { stream: true });
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      let obj: OpenSharingStreamChunk;
      try {
        obj = JSON.parse(trimmed) as OpenSharingStreamChunk;
      } catch {
        continue;
      }

      if (obj.done) {
        onDone();
        finished = true;
        break;
      }
      if (obj.token) onToken(obj.token);
    }
  }
}

// Placeholder functions for local execution
// These would integrate with llama.cpp or similar for actual inference

async function downloadWeights(
  _storageUrl: string,
  _storageType: 'aws' | 'azure' | 'gcs' | 'r2'
): Promise<Buffer> {
  // TODO: Download GGUF/safetensors from storage URL
  // For now, throw error (local inference not yet implemented)
  throw new Error('Local weight download not yet implemented');
}

async function runLocalInference(_weights: Buffer, _prompt: string): Promise<string> {
  throw new Error('Local inference not yet implemented');
}

async function streamLocalInference(
  _weights: Buffer,
  _prompt: string,
  _onToken: (token: string) => void,
  _onDone: () => void
): Promise<void> {
  throw new Error('Local streaming inference not yet implemented');
}

async function computeEmbedding(_weights: Buffer, _text: string): Promise<number[]> {
  throw new Error('Embedding not yet implemented');
}
