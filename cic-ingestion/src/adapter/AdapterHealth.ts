import { AdapterHealthStatus } from "./AdapterCacheTypes";

export interface HealthCheckResult {
  adapterId: string;
  isHealthy: boolean;
  responseTime: number;
  error?: string;
}

export class AdapterHealthMonitor {
  private healthChecks: Map<string, AdapterHealthStatus>;
  private checkIntervalMs: number;
  private readonly failureThreshold = 3;
  private readonly recoveryCheckCount = 2;

  constructor(checkIntervalMs: number = 30000) {
    this.healthChecks = new Map();
    this.checkIntervalMs = checkIntervalMs;
  }

  registerAdapter(adapterId: string): void {
    this.healthChecks.set(adapterId, {
      adapterId,
      isHealthy: true,
      lastCheck: Date.now(),
      failureCount: 0,
      successCount: 0,
    });
  }

  recordSuccess(adapterId: string, now: number = Date.now()): void {
    const health = this.healthChecks.get(adapterId);
    if (health) {
      health.successCount++;
      health.lastCheck = now;

      if (!health.isHealthy && health.failureCount > 0) {
        health.failureCount--;
      } else {
        health.failureCount = Math.max(0, health.failureCount - 1);
      }

      if (health.failureCount === 0) {
        health.isHealthy = true;
      }
    }
  }

  recordFailure(adapterId: string, now: number = Date.now()): void {
    const health = this.healthChecks.get(adapterId);
    if (health) {
      health.failureCount++;
      health.lastCheck = now;

      if (health.failureCount >= this.failureThreshold) {
        health.isHealthy = false;
      }
    }
  }

  getStatus(adapterId: string): AdapterHealthStatus | null {
    return this.healthChecks.get(adapterId) || null;
  }

  isHealthy(adapterId: string): boolean {
    const health = this.healthChecks.get(adapterId);
    return health?.isHealthy ?? false;
  }

  getAllStatus(): AdapterHealthStatus[] {
    return Array.from(this.healthChecks.values());
  }

  getHealthyAdapters(): string[] {
    return Array.from(this.healthChecks.values())
      .filter(h => h.isHealthy)
      .map(h => h.adapterId);
  }

  reset(adapterId: string): void {
    const health = this.healthChecks.get(adapterId);
    if (health) {
      health.failureCount = 0;
      health.successCount = 0;
      health.isHealthy = true;
      health.lastCheck = Date.now();
    }
  }

  resetAll(): void {
    for (const health of this.healthChecks.values()) {
      health.failureCount = 0;
      health.successCount = 0;
      health.isHealthy = true;
      health.lastCheck = Date.now();
    }
  }
}
