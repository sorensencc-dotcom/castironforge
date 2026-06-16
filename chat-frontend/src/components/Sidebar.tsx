import React from 'react';
import { useHealth } from '../hooks/useHealth';
import type { RuntimeStatus } from '../types/chat';

const STATUS_COLOR: Record<RuntimeStatus, string> = {
  ok: 'bg-green-500',
  degraded: 'bg-yellow-500',
  error: 'bg-red-500',
  unreachable: 'bg-red-700',
  unknown: 'bg-neutral-600'
};

function StatusDot({ status }: { status: RuntimeStatus }) {
  return (
    <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${STATUS_COLOR[status]}`} />
  );
}

export function Sidebar() {
  const health = useHealth();

  const runtimes: [string, RuntimeStatus][] = [
    ['Ollama', health.ollama],
    ['TorqueQuery', health.torque],
    ['llama.cpp', health.llamacpp]
  ];

  return (
    <div className="w-64 bg-neutral-900 border-r border-neutral-800 p-4 flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold mb-3">Sources</h2>
        <p className="text-neutral-400 text-sm">
          Indexed MkDocs, repos, and local files will show here.
        </p>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-3">
          Runtimes
        </h3>
        <ul className="space-y-2">
          {runtimes.map(([label, status]) => (
            <li key={label} className="flex items-center gap-2 text-sm text-neutral-300">
              <StatusDot status={status} />
              <span className="flex-1">{label}</span>
              <span className="text-xs text-neutral-500">{status}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
