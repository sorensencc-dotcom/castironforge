import { DistributedMinIOClient } from './DistributedMinIOClient';
import { DatacenterHealth } from './types';

export class FailoverManager {
  private healthCheckInterval: NodeJS.Timer | null = null;
  private readonly healthCheckIntervalMs: number;

  constructor(
    private minioClient: DistributedMinIOClient,
    healthCheckIntervalMs: number = 10000
  ) {
    this.healthCheckIntervalMs = healthCheckIntervalMs;
  }

  start(): void {
    if (this.healthCheckInterval) return;

    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck().catch(error => {
        console.error('Health check error:', error);
      });
    }, this.healthCheckIntervalMs);

    console.log(`[FailoverManager] Started with ${this.healthCheckIntervalMs}ms interval`);
  }

  stop(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      console.log('[FailoverManager] Stopped');
    }
  }

  private async performHealthCheck(): Promise<void> {
    const previousActive = this.minioClient.getActiveDC();

    await this.minioClient.checkHealth();

    const currentActive = this.minioClient.getActiveDC();
    const health = this.minioClient.getHealthStatus();

    if (previousActive !== currentActive) {
      console.log(`[FailoverManager] Failover: ${previousActive} -> ${currentActive}`);
      this.onFailover(previousActive, currentActive, health);
    }
  }

  private onFailover(fromDC: string, toDC: string, health: DatacenterHealth[]): void {
    // Emit event or call handler
    const event = {
      timestamp: Date.now(),
      fromDC,
      toDC,
      health,
      reason: `DC ${fromDC} unhealthy, switched to ${toDC}`
    };

    console.log('[FailoverManager] Failover event:', event);
  }

  getStatus(): {
    activeDC: string;
    health: DatacenterHealth[];
    isHealthy: boolean;
  } {
    return {
      activeDC: this.minioClient.getActiveDC(),
      health: this.minioClient.getHealthStatus(),
      isHealthy: this.minioClient.isHealthy()
    };
  }
}
