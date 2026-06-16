import { useState, useEffect } from 'react';
import { fetchModels } from '../api/chatApi';
import type { Model } from '../types/chat';

const FALLBACK_MODELS: Model[] = [
  { id: 'local:qwen2.5', name: 'qwen2.5', runtime: 'ollama' },
  { id: 'local:llama3.1', name: 'llama3.1', runtime: 'ollama' },
  { id: 'local:deepseek-coder', name: 'deepseek-coder', runtime: 'llamacpp' }
];

export function useModels() {
  const [models, setModels] = useState<Model[]>(FALLBACK_MODELS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetchModels()
      .then(m => { if (!cancelled) setModels(m); })
      .catch(() => { /* keep fallback list */ })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, []);

  return { models, loading };
}
