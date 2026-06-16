import { useState, useEffect } from 'react';
import { fetchHealth } from '../api/chatApi';
import type { HealthStatus } from '../types/chat';

const POLL_INTERVAL_MS = 30_000;

const UNREACHABLE: HealthStatus = {
  ollama: 'unreachable',
  torque: 'unreachable',
  llamacpp: 'unreachable'
};

export function useHealth() {
  const [health, setHealth] = useState<HealthStatus>({
    ollama: 'unknown',
    torque: 'unknown',
    llamacpp: 'unknown'
  });

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const h = await fetchHealth();
        if (!cancelled) setHealth(h);
      } catch {
        if (!cancelled) setHealth(UNREACHABLE);
      }
    }

    void check();
    const id = setInterval(() => void check(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return health;
}
