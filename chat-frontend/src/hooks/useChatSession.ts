import { useState } from 'react';
import type { ChatMessage } from '../types/chat';

export function useChatSession() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  function addMessage(msg: ChatMessage) {
    setMessages(prev => [...prev, msg]);
  }

  return { messages, addMessage };
}
