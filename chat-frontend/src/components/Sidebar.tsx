import React from 'react';
import { useHealth } from '../hooks/useHealth';
import type { RuntimeStatus } from '../types/chat';

const STATUS_COLOR: Record<RuntimeStatus, string> = {
  ok: 'bg-emerald-500',
  degraded: 'bg-amber-400',
  error: 'bg-red-500',
  unreachable: 'bg-zinc-600',
  unknown: 'bg-zinc-700'
};

const STATUS_LABEL: Record<RuntimeStatus, string> = {
  ok: 'online',
  degraded: 'degraded',
  error: 'error',
  unreachable: 'offline',
  unknown: '…'
};

function StatusDot({ status }: { status: RuntimeStatus }) {
  return (
    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_COLOR[status]}`} />
  );
}

export function Sidebar() {
  const health = useHealth();

  const runtimes: [string, RuntimeStatus][] = [
    ['Ollama', health.ollama],
    ['llama.cpp', health.llamacpp],
    ['TorqueQuery', health.torque],
  ];

  return (
    <aside className="w-56 bg-zinc-900 border-r border-zinc-800/60 flex flex-col shrink-0">
      <div className="p-4 border-b border-zinc-800/60">
        <button className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          New chat
        </button>
      </div>

      <div className="flex-1 p-4">
        <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">Sources</p>
        <p className="text-xs text-zinc-600 leading-relaxed">
          Indexed MkDocs, repos, and local files will appear here.
        </p>
      </div>

      <div className="p-4 border-t border-zinc-800/60">
        <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">Runtimes</p>
        <ul className="space-y-2.5">
          {runtimes.map(([label, status]) => (
            <li key={label} className="flex items-center gap-2">
              <StatusDot status={status} />
              <span className="text-xs text-zinc-400 flex-1">{label}</span>
              <span className="text-xs text-zinc-600">{STATUS_LABEL[status]}</span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
