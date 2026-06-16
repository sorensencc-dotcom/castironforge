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
