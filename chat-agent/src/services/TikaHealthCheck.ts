import { TIKA_URL } from '../runtimes/config';
import type { HealthStatus } from '../runtimes/types';

class TikaHealthCheck {
  private lastStatus: HealthStatus = 'error';
  private lastCheck: number = 0;
  private cacheMs: number = 30000; // Cache health check for 30s

  async check(): Promise<HealthStatus> {
    const now = Date.now();
    if (now - this.lastCheck < this.cacheMs) {
      return this.lastStatus;
    }

    try {
      const res = await fetch(`${TIKA_URL}/tika`, {
        method: 'OPTIONS',
        timeout: 5000
      } as any);

      this.lastStatus = res.ok ? 'ok' : 'degraded';
    } catch {
      this.lastStatus = 'error';
    }

    this.lastCheck = now;
    return this.lastStatus;
  }

  getLastStatus(): HealthStatus {
    return this.lastStatus;
  }
}

export const tikaHealthCheck = new TikaHealthCheck();
