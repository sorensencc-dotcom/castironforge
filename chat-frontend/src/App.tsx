import React from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatWindow } from './components/ChatWindow';
import { ModelSelector } from './components/ModelSelector';
import { DebugPanel } from './components/DebugPanel';

export default function App() {
  return (
    <div className="flex h-screen">
      <Sidebar />

      <div className="flex flex-col flex-1">
        <ModelSelector />
        <ChatWindow />
        <DebugPanel />
      </div>
    </div>
  );
}
