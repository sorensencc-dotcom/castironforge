export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface ChatSession {
  id: string;
  messages: ChatMessage[];
}

export interface ChatRequest {
  sessionId: string;
  model: string;
  message: string;
}

export type RuntimeStatus = 'ok' | 'degraded' | 'error' | 'unreachable' | 'unknown';

export interface HealthStatus {
  ollama: RuntimeStatus;
  torque: RuntimeStatus;
  llamacpp: RuntimeStatus;
}

export interface Model {
  id: string;
  name: string;
  runtime: string;
  size?: string;
}
