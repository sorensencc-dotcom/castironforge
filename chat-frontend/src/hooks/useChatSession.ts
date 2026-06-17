import { useState, useRef } from 'react';
import type { ChatMessage } from '../types/chat';

export function useChatSession() {
  const [sessionId] = useState(() => crypto.randomUUID());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [model, setModel] = useState('local:qwen2.5');
  const [isStreaming, setIsStreaming] = useState(false);
  const pendingAssistantIdRef = useRef<string | null>(null);

  function addMessage(msg: ChatMessage) {
    if (msg.role === 'assistant') pendingAssistantIdRef.current = msg.id;
    setMessages(prev => [...prev, msg]);
  }

  function updateLastAssistantMessage(content: string) {
    const targetId = pendingAssistantIdRef.current;
    if (!targetId) return;
    setMessages(prev =>
      prev.map(m => (m.id === targetId ? { ...m, content } : m))
    );
  }

  return {
    sessionId,
    messages,
    addMessage,
    updateLastAssistantMessage,
    model,
    setModel,
    isStreaming,
    setIsStreaming
  };
}
