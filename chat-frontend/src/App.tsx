import React from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatWindow } from './components/ChatWindow';
import { ModelSelector } from './components/ModelSelector';
import { DebugPanel } from './components/DebugPanel';
import { useChatSession } from './hooks/useChatSession';

export default function App() {
  const { model, setModel, isStreaming } = useChatSession();

  return (
    <div className="flex h-screen">
      <Sidebar />

      <div className="flex flex-col flex-1">
        <ModelSelector model={model} onChange={setModel} />
        <ChatWindow />
        <DebugPanel isStreaming={isStreaming} />
      </div>
    </div>
  );
}
