import { useState } from 'react';
import type { ChatMessage } from '../types/chat';

export function useChatSession() {
  const [sessionId] = useState(() => crypto.randomUUID());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [model, setModel] = useState('local:qwen2.5');
  const [isStreaming, setIsStreaming] = useState(false);

  function addMessage(msg: ChatMessage) {
    setMessages(prev => [...prev, msg]);
  }

  function updateLastAssistantMessage(content: string) {
    setMessages(prev => {
      const copy = [...prev];
      for (let i = copy.length - 1; i >= 0; i--) {
        if (copy[i].role === 'assistant') {
          copy[i] = { ...copy[i], content };
          break;
        }
      }
      return copy;
    });
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
