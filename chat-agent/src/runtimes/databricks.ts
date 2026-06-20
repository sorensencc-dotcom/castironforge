import type { RuntimeAdapter, HealthStatus, RuntimeModel, CompleteParams, StreamParams } from './types';
import { DATABRICKS_WORKSPACE_URL, DATABRICKS_TOKEN, DATABRICKS_ENDPOINT_NAME } from './config';

// Databricks API types
interface DatabricksModel {
  name: string;
  state: string;
  served_entities?: Array<{
    entity_name: string;
  }>;
}

interface DatabricksEndpointStatus {
  name: string;
  state: 'READY' | 'PENDING' | 'FAILED';
  served_entities?: Array<{
    entity_name: string;
    state: string;
  }>;
}

interface DatabricksInvocation {
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  max_tokens?: number;
  temperature?: number;
}

interface DatabricksResponse {
  choices: Array<{
    message: {
      content: string;
      role: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface DatabricksStreamChunk {
  choices: Array<{
    delta?: {
      content?: string;
    };
    finish_reason?: string;
  }>;
}

export const databricksAdapter: RuntimeAdapter = {
  async health(): Promise<HealthStatus> {
    try {
      const res = await fetch(
        `${DATABRICKS_WORKSPACE_URL}/api/2.0/serving-endpoints/${DATABRICKS_ENDPOINT_NAME}`,
        {
          headers: {
            'Authorization': `Bearer ${DATABRICKS_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!res.ok) {
        return 'error';
      }

      const data = (await res.json()) as DatabricksEndpointStatus;
      if (data.state === 'READY') {
        return 'ok';
      }
      if (data.state === 'PENDING') {
        return 'degraded';
      }
      return 'error';
    } catch {
      return 'error';
    }
  },

  async models(): Promise<RuntimeModel[]> {
    try {
      const res = await fetch(
        `${DATABRICKS_WORKSPACE_URL}/api/2.0/serving-endpoints/${DATABRICKS_ENDPOINT_NAME}`,
        {
          headers: {
            'Authorization': `Bearer ${DATABRICKS_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!res.ok) {
        return [];
      }

      const data = (await res.json()) as DatabricksEndpointStatus;

      if (data.state !== 'READY') {
        return [];
      }

      // Return the served model
      return [
        {
          id: `databricks:${DATABRICKS_ENDPOINT_NAME}`,
          name: DATABRICKS_ENDPOINT_NAME,
          runtime: 'databricks',
          size: '132b' // DBRX default
        }
      ];
    } catch {
      return [];
    }
  },

  async complete({ model, message }: CompleteParams): Promise<string> {
    const res = await fetch(
      `${DATABRICKS_WORKSPACE_URL}/api/2.0/serving-endpoints/${DATABRICKS_ENDPOINT_NAME}/invocations`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${DATABRICKS_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: message
            }
          ],
          max_tokens: 2048,
          temperature: 0.7
        } as DatabricksInvocation)
      }
    );

    if (!res.ok) {
      throw new Error(`Databricks invocation failed: HTTP ${res.status}`);
    }

    const data = (await res.json()) as DatabricksResponse;
    return data.choices[0]?.message?.content ?? '';
  },

  async stream({ model, message, onToken, onDone }: StreamParams): Promise<void> {
    const res = await fetch(
      `${DATABRICKS_WORKSPACE_URL}/api/2.0/serving-endpoints/${DATABRICKS_ENDPOINT_NAME}/invocations`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${DATABRICKS_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: message
            }
          ],
          max_tokens: 2048,
          temperature: 0.7,
          stream: true
        } as DatabricksInvocation & { stream: boolean })
      }
    );

    if (!res.ok || !res.body) {
      throw new Error(`Databricks stream failed: HTTP ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let finished = false;

    while (!finished) {
      const chunk = await reader.read();
      if (chunk.done) break;

      const text = decoder.decode(chunk.value, { stream: true });

      // Parse Server-Sent Events
      for (const line of text.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) continue;

        if (trimmed.startsWith('data: ')) {
          const dataStr = trimmed.slice(6);
          if (dataStr === '[DONE]') {
            onDone();
            finished = true;
            break;
          }

          try {
            const data = JSON.parse(dataStr) as DatabricksStreamChunk;
            const delta = data.choices?.[0]?.delta;

            if (delta?.content) {
              onToken(delta.content);
            }

            if (data.choices?.[0]?.finish_reason) {
              onDone();
              finished = true;
              break;
            }
          } catch {
            // Ignore parsing errors in streaming
          }
        }
      }
    }
  },

  async embed(text: string): Promise<number[]> {
    // Databricks embedding endpoint (if configured)
    // For now, throw error
    throw new Error('Databricks embedding not yet implemented');
  }
};
