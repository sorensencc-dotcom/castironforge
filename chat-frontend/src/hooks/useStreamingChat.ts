import { useCallback, useEffect, useRef } from 'react';
import { streamChatMessage, sendChatMessage } from '../api/chatApi';
import type { ChatRequest, ChatMessage } from '../types/chat';

interface UseStreamingChatParams {
  addMessage: (m: ChatMessage) => void;
  updateLastAssistantMessage: (content: string) => void;
  setIsStreaming: (v: boolean) => void;
}

export function useStreamingChat({
  addMessage,
  updateLastAssistantMessage,
  setIsStreaming
}: UseStreamingChatParams) {
  const closeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => { closeRef.current?.(); };
  }, []);

  const send = useCallback(
    async (payload: ChatRequest, useStream: boolean) => {
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: payload.message,
        timestamp: Date.now()
      };
      addMessage(userMsg);

      if (!useStream) {
        const assistant = await sendChatMessage(payload);
        addMessage(assistant);
        return;
      }

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '',
        timestamp: Date.now()
      };
      addMessage(assistantMsg);
      setIsStreaming(true);

      let buffer = '';

      closeRef.current = streamChatMessage(
        payload,
        token => {
          buffer += token;
          updateLastAssistantMessage(buffer);
        },
        () => {
          closeRef.current = null;
          setIsStreaming(false);
        },
        err => {
          console.error('Streaming error', err);
          closeRef.current = null;
          setIsStreaming(false);
        }
      );
    },
    [addMessage, updateLastAssistantMessage, setIsStreaming]
  );

  return { send };
}
