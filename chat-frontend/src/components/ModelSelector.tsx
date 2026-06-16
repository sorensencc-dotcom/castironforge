import React from 'react';
import { useModels } from '../hooks/useModels';

interface Props {
  model: string;
  onChange: (model: string) => void;
}

export function ModelSelector({ model, onChange }: Props) {
  const { models, loading } = useModels();

  return (
    <div className="p-4 border-b border-neutral-800 flex gap-4 items-center">
      <div className="flex-1">
        <label className="block text-sm mb-1">Model</label>
        <select
          className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 disabled:opacity-50"
          value={model}
          onChange={e => onChange(e.target.value)}
          disabled={loading}
        >
          {models.map(m => (
            <option key={m.id} value={m.id}>
              {m.runtime}: {m.name}{m.size ? ` (${m.size})` : ''}
            </option>
          ))}
        </select>
      </div>
      <span className="text-xs text-neutral-500">
        {loading ? 'Loading models…' : `${models.length} model${models.length !== 1 ? 's' : ''} available`}
      </span>
    </div>
  );
}
