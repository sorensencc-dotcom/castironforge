import React from 'react';

export function ModelSelector() {
  return (
    <div className="p-4 border-b border-neutral-800">
      <label className="block text-sm mb-2">Model</label>
      <select className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2">
        <option>local: qwen2.5</option>
        <option>local: llama3.1</option>
        <option>local: deepseek-coder</option>
      </select>
    </div>
  );
}
