import React from 'react';

interface Props {
  model: string;
  onChange: (model: string) => void;
}

export function ModelSelector({ model, onChange }: Props) {
  return (
    <div className="p-4 border-b border-neutral-800 flex gap-4 items-center">
      <div className="flex-1">
        <label className="block text-sm mb-1">Model</label>
        <select
          className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2"
          value={model}
          onChange={e => onChange(e.target.value)}
        >
          <option value="local:qwen2.5">local: qwen2.5</option>
          <option value="local:llama3.1">local: llama3.1</option>
          <option value="local:deepseek-coder">local: deepseek-coder</option>
        </select>
      </div>
      <span className="text-xs text-neutral-500">
        Local inference node (Ollama / llama.cpp)
      </span>
    </div>
  );
}
