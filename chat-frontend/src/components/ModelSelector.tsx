import React from 'react';
import { useModels } from '../hooks/useModels';

interface Props {
  model: string;
  onChange: (model: string) => void;
}

export function ModelSelector({ model, onChange }: Props) {
  const { models, loading } = useModels();

  const current = models.find(m => m.id === model);
  const label = current ? current.name : model.split(':')[1] ?? model;

  return (
    <div className="relative">
      <select
        className="appearance-none bg-stone-800 hover:bg-stone-700 border border-stone-700/60 text-stone-300 text-xs rounded-lg pl-3 pr-7 py-1.5 cursor-pointer disabled:opacity-40 transition-colors focus:outline-none focus:ring-1 focus:ring-orange-500"
        value={model}
        onChange={e => onChange(e.target.value)}
        disabled={loading}
        title={loading ? 'Loading models…' : `${models.length} model${models.length !== 1 ? 's' : ''}`}
      >
        {models.map(m => (
          <option key={m.id} value={m.id}>
            {m.name}{m.size ? ` · ${m.size}` : ''}
          </option>
        ))}
      </select>
      <svg
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-stone-500"
        width="10" height="10" viewBox="0 0 10 10" fill="none"
      >
        <path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  );
}
