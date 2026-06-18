import React from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatWindow } from './components/ChatWindow';
import { ModelSelector } from './components/ModelSelector';
import { useChatSession } from './hooks/useChatSession';

export default function App() {
  const session = useChatSession();

  return (
    <div className="flex h-screen bg-stone-950 text-stone-100 overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <header className="flex items-center justify-between px-6 py-3 border-b border-stone-800/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-orange-600 flex items-center justify-center shrink-0">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M1.5 3h9M1.5 6h6M1.5 9h9" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <span className="font-semibold text-sm tracking-tight">CastIronForge</span>
          </div>
          <ModelSelector model={session.model} onChange={session.setModel} />
        </header>
        <ChatWindow session={session} />
      </div>
    </div>
  );
}
